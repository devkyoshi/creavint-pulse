import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, isNotNull, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { articles, seoAudits, type Site } from "../db/schema.ts";
import { contentStore } from "../integrations/git/contentStore.ts";
import type { ChecklistItem, ChecklistResult } from "../types.ts";

const TRUST_PAGES = ["about", "contact", "privacy", "terms", "editorial-policy", "author"];
const PLACEHOLDER_PATTERNS = /lorem ipsum|\[placeholder\]|\bTODO\b|\bTBD\b|xxx-xxx/i;

/** AdSense application readiness — the hard gate before `adsense_applied` (§6.3). */
export async function adsenseChecklist(site: Site): Promise<ChecklistResult> {
  const items: ChecklistItem[] = [];

  const [indexedRow] = await db
    .select({ count: dsql<number>`count(*)::int` })
    .from(articles)
    .where(and(eq(articles.siteId, site.id), isNotNull(articles.indexedAt)));
  const indexedCount = indexedRow?.count ?? 0;
  items.push({
    key: "indexed_articles",
    label: "≥20 indexed articles (GSC confirmed)",
    pass: indexedCount >= 20,
    detail: `${indexedCount} indexed`,
  });

  const siteDir = contentStore.siteDir(site.slug);
  const missingPages = TRUST_PAGES.filter(
    (p) =>
      !fs.existsSync(path.join(siteDir, "content", `${p}.md`)) &&
      !fs.existsSync(path.join(siteDir, "content", p, "index.md")),
  );
  items.push({
    key: "trust_pages",
    label: "All trust pages live (About, Contact, Privacy, Terms, Editorial Policy, Author)",
    pass: missingPages.length === 0,
    detail: missingPages.length === 0 ? "all present" : `missing: ${missingPages.join(", ")}`,
  });

  const [oldest] = await db
    .select({ publishedAt: articles.publishedAt })
    .from(articles)
    .where(and(eq(articles.siteId, site.id), isNotNull(articles.publishedAt)))
    .orderBy(asc(articles.publishedAt))
    .limit(1);
  const historyDays = oldest?.publishedAt
    ? Math.floor((Date.now() - oldest.publishedAt.getTime()) / 86_400_000)
    : 0;
  items.push({
    key: "posting_history",
    label: "≥14 days of posting history",
    pass: historyDays >= 14,
    detail: `${historyDays} days`,
  });

  const adsTxt = fs.existsSync(path.join(siteDir, "static", "ads.txt"));
  items.push({
    key: "ads_txt",
    label: "ads.txt deployed",
    pass: adsTxt,
    detail: adsTxt ? "present" : "static/ads.txt missing",
  });

  const [latestAudit] = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.siteId, site.id))
    .orderBy(desc(seoAudits.runAt))
    .limit(1);
  const cwv = (latestAudit?.resultsJson as { cwv?: { pass?: boolean } } | undefined)?.cwv;
  items.push({
    key: "cwv",
    label: "Core Web Vitals passing",
    pass: cwv?.pass === true,
    detail: latestAudit ? (cwv?.pass === true ? "passing" : "not passing / unknown") : "no SEO audit data yet",
  });

  const published = await db
    .select({ title: articles.title, frontmatter: articles.frontmatterJson })
    .from(articles)
    .where(and(eq(articles.siteId, site.id), isNotNull(articles.publishedAt)))
    .limit(200);
  const placeholderHits = published.filter((a) =>
    PLACEHOLDER_PATTERNS.test(`${a.title} ${JSON.stringify(a.frontmatter)}`),
  );
  items.push({
    key: "no_placeholder",
    label: "No placeholder content detected",
    pass: placeholderHits.length === 0,
    detail:
      placeholderHits.length === 0
        ? "clean"
        : `placeholder text in: ${placeholderHits.map((a) => a.title).join(", ")}`,
  });

  return { pass: items.every((i) => i.pass), items };
}
