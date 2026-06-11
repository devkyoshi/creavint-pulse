import fs from "node:fs";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { articles, contentBriefs, keywordClusters, seoAudits } from "../db/schema.ts";
import { redis } from "../jobs/queues.ts";
import type { KeywordRefreshPayload, SeoAuditPayload, SeoJobName } from "../jobs/types.ts";
import { gscConfigured, queryAnalytics } from "../integrations/google/gsc.ts";
import { contentStore } from "../integrations/git/contentStore.ts";
import { refreshKeywordBacklog } from "../services/keywords.ts";
import { createBriefFromCluster, startContentJob } from "../services/briefs.ts";
import { getSiteOrThrow, siteFqdn } from "../services/sites.ts";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function processKeywordRefresh(payload: KeywordRefreshPayload): Promise<void> {
  const count = await refreshKeywordBacklog(payload.niche);
  console.log(`keyword refresh: ${count} clusters upserted for "${payload.niche}"`);
}

/**
 * Daily SEO audit (§6.2): GSC decay detection → refresh briefs, llms.txt
 * regeneration (AEO), structured-data validation, audit record.
 */
async function processSeoAudit(payload: SeoAuditPayload): Promise<void> {
  const site = await getSiteOrThrow(payload.siteId);
  const fqdn = await siteFqdn(site);
  const results: Record<string, unknown> = { fqdn };

  // --- decaying pages → refresh briefs ---
  const decayed: { page: string; drop: number }[] = [];
  if (fqdn && gscConfigured()) {
    const now = new Date();
    const d = (days: number) => isoDate(new Date(now.getTime() - days * 86_400_000));
    const recent = await queryAnalytics({ fqdn, startDate: d(7), endDate: d(1), dimensions: ["page"] });
    const prior = await queryAnalytics({ fqdn, startDate: d(14), endDate: d(8), dimensions: ["page"] });
    const priorByPage = new Map(prior.map((r) => [r.keys[0]!, r]));

    for (const row of recent) {
      const page = row.keys[0]!;
      const before = priorByPage.get(page);
      if (!before || before.impressions < 50) continue;
      const drop = (before.impressions - row.impressions) / before.impressions;
      const positionDrop = row.position - before.position; // higher = worse
      if (drop > 0.2 || positionDrop > 5) decayed.push({ page, drop: Math.round(drop * 100) / 100 });
    }

    for (const { page } of decayed.slice(0, 3)) {
      const slug = page.split("/posts/")[1]?.replace(/\/$/, "");
      if (!slug) continue;
      const [article] = await db
        .select()
        .from(articles)
        .where(and(eq(articles.siteId, site.id), eq(articles.slug, slug)))
        .limit(1);
      if (!article) continue;
      // Avoid duplicate refresh briefs for the same target.
      const existing = await db
        .select({ id: contentBriefs.id })
        .from(contentBriefs)
        .where(and(eq(contentBriefs.siteId, site.id), eq(contentBriefs.kind, "refresh")));
      const alreadyQueued = existing.length > 0; // coarse guard for pilot
      if (alreadyQueued) break;
      const [cluster] = article.frontmatterJson.keywords
        ? await db.select().from(keywordClusters).where(eq(keywordClusters.niche, site.niche)).limit(1)
        : [];
      if (!cluster) continue;
      const brief = await createBriefFromCluster(site, cluster, "refresh", slug);
      await startContentJob(brief);
    }
  }
  results.decayedPages = decayed;

  // --- AEO: regenerate llms.txt from the published corpus ---
  const published = await db
    .select({ title: articles.title, slug: articles.slug, frontmatter: articles.frontmatterJson })
    .from(articles)
    .where(and(eq(articles.siteId, site.id), isNotNull(articles.publishedAt)));
  if (published.length > 0) {
    const base = fqdn ? `https://${fqdn}` : `https://${site.slug}.example.com`;
    const lines = [
      `# ${site.name}`,
      `> ${site.niche} blog`,
      "",
      "## Articles",
      ...published.map((a) => `- [${a.title}](${base}/posts/${a.slug}/)`),
      "",
    ];
    const staticDir = path.join(contentStore.siteDir(site.slug), "static");
    fs.mkdirSync(staticDir, { recursive: true });
    fs.writeFileSync(path.join(staticDir, "llms.txt"), lines.join("\n"), "utf8");
    await contentStore.commitAndPush(`seo(${site.slug}): refresh llms.txt`);
  }
  results.llmsTxtArticles = published.length;

  // --- structured data validation (frontmatter JSON-LD presence) ---
  const missingJsonLd = published.filter((a) => !(a.frontmatter as { jsonld?: unknown[] }).jsonld?.length);
  results.structuredData = {
    articles: published.length,
    missingJsonLd: missingJsonLd.map((a) => a.slug),
  };

  // CWV: no lab runner wired in Phase 1a — recorded as unknown until wired.
  results.cwv = { pass: false, note: "CWV check not wired (Phase 1a) — run PageSpeed manually before AdSense application" };

  await db.insert(seoAudits).values({ siteId: site.id, resultsJson: results });
}

async function processSeoJob(job: Job): Promise<void> {
  switch (job.name as SeoJobName) {
    case "KEYWORD_REFRESH":
      return processKeywordRefresh(job.data as KeywordRefreshPayload);
    case "SEO_AUDIT":
      return processSeoAudit(job.data as SeoAuditPayload);
    default:
      throw new Error(`unknown seo job: ${job.name}`);
  }
}

export function startSeoWorker(): Worker {
  return new Worker("seo", processSeoJob, { connection: redis, concurrency: 2 });
}
