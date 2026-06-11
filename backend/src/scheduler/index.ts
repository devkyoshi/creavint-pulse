import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { sites } from "../db/schema.ts";
import { analyticsQueue, contentQueue, seoQueue } from "../jobs/queues.ts";

const ACTIVE_STATES = ["seeding", "live", "indexed", "adsense_applied", "adsense_approved", "monetized"] as const;

/**
 * Registers all recurring jobs as BullMQ job schedulers. Static crons are
 * fixed; per-site content cadences and SEO audits are synced from the DB
 * (re-run every 15 min via the SYNC tick so new/paused sites are picked up).
 */
export async function syncSchedules(): Promise<void> {
  // --- static network-wide crons ---
  await analyticsQueue.upsertJobScheduler("cron:ga4", { pattern: "0 3 * * *" }, { name: "GA4_PULL", data: {} });
  await analyticsQueue.upsertJobScheduler("cron:gsc", { pattern: "30 3 * * *" }, { name: "GSC_PULL", data: {} });
  await analyticsQueue.upsertJobScheduler(
    "cron:adsense",
    { pattern: "0 4 * * *" },
    { name: "ADSENSE_PULL", data: {} },
  );
  await analyticsQueue.upsertJobScheduler(
    "cron:cost-rollup",
    { pattern: "30 4 * * *" },
    { name: "CONTENT_COST_ROLLUP", data: {} },
  );

  // --- per-site schedules ---
  const activeSites = await db
    .select()
    .from(sites)
    .where(inArray(sites.state, [...ACTIVE_STATES]));

  const wantedContent = new Set<string>();
  const wantedSeo = new Set<string>();
  const wantedKeyword = new Set<string>();

  for (const site of activeSites) {
    const cadenceId = `cadence:${site.id}`;
    wantedContent.add(cadenceId);
    await contentQueue.upsertJobScheduler(
      cadenceId,
      { pattern: site.cadenceJson.cronExpression },
      { name: "CADENCE_TICK", data: { siteId: site.id } },
    );

    const auditId = `seo-audit:${site.id}`;
    wantedSeo.add(auditId);
    await seoQueue.upsertJobScheduler(
      auditId,
      { pattern: "0 2 * * *" },
      { name: "SEO_AUDIT", data: { siteId: site.id } },
    );

    const kwId = `keyword-refresh:${site.niche.toLowerCase().replace(/\s+/g, "-")}`;
    if (!wantedKeyword.has(kwId)) {
      wantedKeyword.add(kwId);
      await seoQueue.upsertJobScheduler(
        kwId,
        { pattern: "0 1 * * 1" }, // weekly, Monday 01:00
        { name: "KEYWORD_REFRESH", data: { niche: site.niche } },
      );
    }
  }

  // --- drop schedulers for sites that are no longer active ---
  for (const scheduler of await contentQueue.getJobSchedulers()) {
    if (scheduler.key.startsWith("cadence:") && !wantedContent.has(scheduler.key)) {
      await contentQueue.removeJobScheduler(scheduler.key);
    }
  }
  for (const scheduler of await seoQueue.getJobSchedulers()) {
    if (scheduler.key.startsWith("seo-audit:") && !wantedSeo.has(scheduler.key)) {
      await seoQueue.removeJobScheduler(scheduler.key);
    }
    if (scheduler.key.startsWith("keyword-refresh:") && !wantedKeyword.has(scheduler.key)) {
      await seoQueue.removeJobScheduler(scheduler.key);
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export async function startScheduler(): Promise<void> {
  await syncSchedules();
  timer = setInterval(() => {
    syncSchedules().catch((e) => console.error("schedule sync failed:", e));
  }, 15 * 60 * 1000);
  timer.unref();
  console.log("scheduler: job schedulers synced");
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
}
