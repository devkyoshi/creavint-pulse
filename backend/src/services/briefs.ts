import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import {
  articles,
  contentBriefs,
  contentJobs,
  type ContentBrief,
  type KeywordCluster,
  type Site,
} from "../db/schema.ts";
import { enqueueContentStage } from "../jobs/enqueue.ts";
import type { BriefKind, InternalLinkCandidate } from "../types.ts";

/** Latest published articles as internal-link candidates for new briefs. */
export async function internalLinkCandidates(siteId: string, limit = 5): Promise<InternalLinkCandidate[]> {
  const rows = await db
    .select({ title: articles.title, slug: articles.slug })
    .from(articles)
    .where(and(eq(articles.siteId, siteId), isNotNull(articles.publishedAt)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return rows;
}

export async function createBriefFromCluster(
  site: Site,
  cluster: KeywordCluster,
  kind: BriefKind = "new",
  targetSlug?: string,
): Promise<ContentBrief> {
  const links = await internalLinkCandidates(site.id);
  const [brief] = await db
    .insert(contentBriefs)
    .values({
      siteId: site.id,
      clusterId: cluster.id,
      kind,
      title: cluster.label,
      outlineJson: {
        targetKeyword: cluster.label,
        keywords: cluster.keywordsJson,
        intent: "informational",
        headings: [],
        targetSlug,
      },
      internalLinkCandidatesJson: links,
      status: "pending",
    })
    .returning();
  return brief!;
}

/** Create a content job for a brief and enqueue the DRAFT stage. */
export async function startContentJob(brief: ContentBrief, priority?: number): Promise<string> {
  const [job] = await db
    .insert(contentJobs)
    .values({ briefId: brief.id, siteId: brief.siteId, state: "briefed" })
    .returning();
  await db.update(contentBriefs).set({ status: "enqueued" }).where(eq(contentBriefs.id, brief.id));
  await enqueueContentStage("DRAFT", job!.id, { priority });
  return job!.id;
}
