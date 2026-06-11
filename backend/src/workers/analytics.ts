import { Worker, type Job } from "bullmq";
import { and, eq, gte, inArray, sql as dsql } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import {
  contentJobs,
  domains,
  gaSnapshots,
  gscSnapshots,
  revenueSnapshots,
  sites,
  type Site,
} from "../db/schema.ts";
import { redis } from "../jobs/queues.ts";
import type { AnalyticsJobName, AnalyticsPayload } from "../jobs/types.ts";
import { ga4Configured, pullDailyMetrics } from "../integrations/google/ga4.ts";
import { gscConfigured, indexedPageCount, queryAnalytics } from "../integrations/google/gsc.ts";
import { adsenseConfigured, pullDailyRevenue } from "../integrations/google/adsense.ts";
import { createAlert } from "../services/alerts.ts";
import { transitionSiteState } from "../services/sites.ts";

const TRACKED_STATES = ["seeding", "live", "indexed", "adsense_applied", "adsense_approved", "monetized"] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function targetDate(payload: AnalyticsPayload): string {
  return payload.date ?? isoDate(new Date(Date.now() - 86_400_000));
}

async function trackedSites(): Promise<(Site & { fqdn: string | null })[]> {
  const rows = await db
    .select({ site: sites, fqdn: domains.fqdn })
    .from(sites)
    .leftJoin(domains, eq(sites.domainId, domains.id))
    .where(inArray(sites.state, [...TRACKED_STATES]));
  return rows.map((r) => ({ ...r.site, fqdn: r.fqdn }));
}

// ---------------------------------------------------------------------------

async function ga4Pull(payload: AnalyticsPayload): Promise<void> {
  if (!ga4Configured()) return console.warn("GA4_PULL skipped: service account not configured");
  const date = targetDate(payload);
  for (const site of await trackedSites()) {
    const propertyId = site.ga4PropertyId ?? config.GA4_PROPERTY_ID;
    if (!propertyId) continue;
    try {
      const m = await pullDailyMetrics(propertyId, date);
      await db
        .insert(gaSnapshots)
        .values({
          siteId: site.id,
          date,
          sessions: m.sessions,
          users: m.users,
          engagementJson: { engagementRate: m.engagementRate },
        })
        .onConflictDoUpdate({
          target: [gaSnapshots.siteId, gaSnapshots.date],
          set: { sessions: m.sessions, users: m.users, engagementJson: { engagementRate: m.engagementRate } },
        });
    } catch (e) {
      console.warn(`GA4 pull failed for ${site.slug}: ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------

async function gscPull(payload: AnalyticsPayload): Promise<void> {
  if (!gscConfigured()) return console.warn("GSC_PULL skipped: service account not configured");
  const date = targetDate(payload);

  for (const site of await trackedSites()) {
    if (!site.fqdn) continue;
    try {
      const dayRows = await queryAnalytics({
        fqdn: site.fqdn,
        startDate: date,
        endDate: date,
        dimensions: ["query"],
        rowLimit: 25,
      });
      const impressions = dayRows.reduce((s, r) => s + r.impressions, 0);
      const clicks = dayRows.reduce((s, r) => s + r.clicks, 0);
      const end = new Date(`${date}T00:00:00Z`);
      const start28 = isoDate(new Date(end.getTime() - 27 * 86_400_000));
      const indexedPages = await indexedPageCount(site.fqdn, start28, date);

      await db
        .insert(gscSnapshots)
        .values({
          siteId: site.id,
          date,
          indexedPages,
          impressions,
          clicks,
          topQueriesJson: dayRows.map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks })),
        })
        .onConflictDoUpdate({
          target: [gscSnapshots.siteId, gscSnapshots.date],
          set: { indexedPages, impressions, clicks },
        });

      await checkIndexationDrop(site, date, indexedPages);
    } catch (e) {
      console.warn(`GSC pull failed for ${site.slug}: ${(e as Error).message}`);
    }
  }
}

/** Indexation early-warning (§8.4): >15% w/w drop → alert + auto-pause. */
async function checkIndexationDrop(site: Site, date: string, current: number): Promise<void> {
  const weekAgo = isoDate(new Date(new Date(`${date}T00:00:00Z`).getTime() - 7 * 86_400_000));
  const [prior] = await db
    .select()
    .from(gscSnapshots)
    .where(and(eq(gscSnapshots.siteId, site.id), eq(gscSnapshots.date, weekAgo)))
    .limit(1);
  if (!prior || prior.indexedPages < 10) return;

  const drop = (prior.indexedPages - current) / prior.indexedPages;
  if (drop <= config.INDEXATION_DROP_THRESHOLD) return;

  await createAlert({
    siteId: site.id,
    severity: "critical",
    type: "INDEXATION_DROP",
    payload: {
      priorIndexed: prior.indexedPages,
      currentIndexed: current,
      dropPct: Math.round(drop * 100),
      autoPaused: true,
    },
  });
  // Continuing to publish into a flagged site makes it worse — auto-pause.
  await transitionSiteState(site.id, "flagged").catch(() => {});
  await transitionSiteState(site.id, "paused").catch(() => {});
}

// ---------------------------------------------------------------------------

async function adsensePull(payload: AnalyticsPayload): Promise<void> {
  if (!adsenseConfigured()) return console.warn("ADSENSE_PULL skipped: oauth/publisher not configured");
  const date = targetDate(payload);
  const revenue = await pullDailyRevenue(date);
  const byDomain = new Map(revenue.map((r) => [r.domain.toLowerCase(), r]));

  for (const site of await trackedSites()) {
    if (!site.fqdn) continue;
    const row = byDomain.get(site.fqdn.toLowerCase());
    if (!row) continue;
    await db
      .insert(revenueSnapshots)
      .values({
        siteId: site.id,
        date,
        adsenseRevenueUsd: row.revenueUsd,
        rpm: row.rpm,
        adImpressions: row.impressions,
      })
      .onConflictDoUpdate({
        target: [revenueSnapshots.siteId, revenueSnapshots.date],
        set: { adsenseRevenueUsd: row.revenueUsd, rpm: row.rpm, adImpressions: row.impressions },
      });
  }
}

// ---------------------------------------------------------------------------

/** Cost anomaly detection: yesterday's LLM spend per site vs trailing average. */
async function contentCostRollup(payload: AnalyticsPayload): Promise<void> {
  const date = targetDate(payload);
  const rows = await db
    .select({
      siteId: contentJobs.siteId,
      day: dsql<string>`to_char(${contentJobs.createdAt}, 'YYYY-MM-DD')`,
      cost: dsql<number>`sum(${contentJobs.tokenCostUsd})`,
    })
    .from(contentJobs)
    .where(gte(contentJobs.createdAt, new Date(Date.now() - 8 * 86_400_000)))
    .groupBy(contentJobs.siteId, dsql`to_char(${contentJobs.createdAt}, 'YYYY-MM-DD')`);

  const bySite = new Map<string, { day: string; cost: number }[]>();
  for (const r of rows) {
    const list = bySite.get(r.siteId) ?? [];
    list.push({ day: r.day, cost: Number(r.cost) });
    bySite.set(r.siteId, list);
  }

  for (const [siteId, days] of bySite) {
    const today = days.find((d) => d.day === date)?.cost ?? 0;
    const others = days.filter((d) => d.day !== date).map((d) => d.cost);
    if (others.length === 0 || today === 0) continue;
    const avg = others.reduce((s, c) => s + c, 0) / others.length;
    if (avg > 0.5 && today > avg * 3) {
      await createAlert({
        siteId,
        severity: "high",
        type: "REVENUE_ANOMALY",
        payload: { kind: "content_cost_spike", date, costUsd: today, trailingAvgUsd: Math.round(avg * 100) / 100 },
      });
    }
  }
}

// ---------------------------------------------------------------------------

async function processAnalytics(job: Job): Promise<void> {
  const payload = job.data as AnalyticsPayload;
  switch (job.name as AnalyticsJobName) {
    case "GA4_PULL":
      return ga4Pull(payload);
    case "GSC_PULL":
      return gscPull(payload);
    case "ADSENSE_PULL":
      return adsensePull(payload);
    case "CONTENT_COST_ROLLUP":
      return contentCostRollup(payload);
    default:
      throw new Error(`unknown analytics job: ${job.name}`);
  }
}

export function startAnalyticsWorker(): Worker {
  return new Worker("analytics", processAnalytics, { connection: redis, concurrency: 1 });
}
