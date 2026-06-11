import { Worker, type Job } from "bullmq";
import { and, eq, sql as dsql } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import {
  articles,
  contentBriefs,
  contentJobs,
  mediaAssets,
  type ContentBrief,
  type ContentJob,
  type Site,
} from "../db/schema.ts";
import { redis } from "../jobs/queues.ts";
import { enqueueContentStage } from "../jobs/enqueue.ts";
import type { CadenceTickPayload, ContentStage, ContentStagePayload } from "../jobs/types.ts";
import { getLLM } from "../integrations/llm/claude.ts";
import { embed } from "../integrations/llm/embeddings.ts";
import { generateImage, replicateConfigured } from "../integrations/replicate/client.ts";
import { gscConfigured, inspectUrl, submitSitemap } from "../integrations/google/gsc.ts";
import { staticBlogAdapter } from "../adapters/static-blog/index.ts";
import { runQualityGate, routeReview } from "../services/quality.ts";
import { createAlert } from "../services/alerts.ts";
import { getSiteOrThrow, siteFqdn, transitionSiteState } from "../services/sites.ts";
import { startContentJob } from "../services/briefs.ts";
import { nextClusters } from "../services/keywords.ts";
import { createBriefFromCluster } from "../services/briefs.ts";
import {
  deriveMetaDescription,
  extractFaq,
  extractTitle,
  slugify,
  shortId,
  stripFirstH1,
  truncate,
} from "../lib/text.ts";
import type { ContentJobState } from "../types.ts";

interface JobContext {
  job: ContentJob;
  brief: ContentBrief;
  site: Site;
}

async function loadContext(contentJobId: string): Promise<JobContext> {
  const [job] = await db.select().from(contentJobs).where(eq(contentJobs.id, contentJobId)).limit(1);
  if (!job) throw new Error(`content job not found: ${contentJobId}`);
  const [brief] = await db.select().from(contentBriefs).where(eq(contentBriefs.id, job.briefId)).limit(1);
  if (!brief) throw new Error(`brief not found for job ${contentJobId}`);
  const site = await getSiteOrThrow(job.siteId);
  return { job, brief, site };
}

async function setJobState(jobId: string, state: ContentJobState, patch: Partial<typeof contentJobs.$inferInsert> = {}) {
  await db.update(contentJobs).set({ state, ...patch }).where(eq(contentJobs.id, jobId));
}

// ---------------------------------------------------------------------------
// DRAFT
// ---------------------------------------------------------------------------

async function stageDraft({ job, brief, site }: JobContext): Promise<void> {
  const policy = site.contentPolicyJson;
  const outline = brief.outlineJson;
  const links = brief.internalLinkCandidatesJson;

  const system = [
    `You are the staff writer for "${site.name}", a blog about ${site.niche}.`,
    policy.persona ? `Persona: ${policy.persona}.` : "",
    `Tone: ${policy.tone}.`,
    "Write in markdown. Start with a single H1 title line. Use H2/H3 structure.",
    `Length: ${policy.wordCountMin}-${policy.wordCountMax} words.`,
    'End with a "## FAQ" section containing 3-5 questions as H3 headings with concise answers.',
    "Hard rules: no fabricated statistics, no unverifiable claims — cite a source inline or omit the claim. " +
      "Never use placeholder text.",
    policy.forbiddenTopics.length ? `Never discuss: ${policy.forbiddenTopics.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    `Write an article targeting the keyword cluster: "${outline.targetKeyword}".`,
    `Related keywords to weave in naturally: ${outline.keywords.join(", ")}.`,
    `Search intent: ${outline.intent}.`,
    outline.headings.length ? `Required outline:\n${outline.headings.map((h) => `- ${h}`).join("\n")}` : "",
    links.length
      ? `Existing articles you may reference (for context only, links are inserted later): ${links.map((l) => l.title).join("; ")}`
      : "",
    brief.kind === "refresh" ? "This is a refresh of an existing article — rewrite for freshness and depth." : "",
    outline.critique ? `A previous draft failed the quality gate. Critique to address:\n${outline.critique}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await getLLM().complete({
    system,
    prompt,
    model: config.LLM_DEFAULT_MODEL,
    maxTokens: 8000,
  });

  const title = extractTitle(res.text) ?? outline.targetKeyword;
  await setJobState(job.id, "drafted", {
    draftMd: res.text,
    title: truncate(title, 120),
    modelUsed: res.model,
    tokenCostUsd: job.tokenCostUsd + res.costUsd,
  });
  await db.update(contentBriefs).set({ status: "in_progress" }).where(eq(contentBriefs.id, brief.id));
  await enqueueContentStage("SEO_PASS", job.id);
}

// ---------------------------------------------------------------------------
// SEO_PASS — deterministic post-processing
// ---------------------------------------------------------------------------

async function stageSeoPass({ job, brief, site }: JobContext): Promise<void> {
  if (!job.draftMd) throw new Error("no draft to process");
  let md = job.draftMd;

  // Title ≤ 60 chars for the SERP; slug from title (keyword-rich, kebab-case).
  const rawTitle = job.title ?? extractTitle(md) ?? brief.outlineJson.targetKeyword;
  const title = truncate(rawTitle, 60);
  let slug = brief.outlineJson.targetSlug ?? slugify(rawTitle);

  // Ensure per-site slug uniqueness (refresh briefs intentionally reuse slugs).
  if (brief.kind !== "refresh") {
    const [clash] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.siteId, site.id), eq(articles.slug, slug)))
      .limit(1);
    if (clash) slug = `${slug}-${shortId()}`;
  }

  const metaDescription = truncate(deriveMetaDescription(stripFirstH1(md)), 160);

  // Internal links from the brief's candidates.
  const links = brief.internalLinkCandidatesJson;
  if (links.length > 0 && !md.includes("## Related Reading")) {
    md += `\n\n## Related Reading\n\n${links.map((l) => `- [${l.title}](/posts/${l.slug}/)`).join("\n")}\n`;
  }

  // schema.org Article + FAQPage JSON-LD stored in frontmatter params.
  const baseUrl = (await siteFqdn(site)) ? `https://${await siteFqdn(site)}` : `https://${site.slug}.example.com`;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": site.seoDefaultsJson.defaultSchemaType || "Article",
    headline: title,
    description: metaDescription,
    datePublished: new Date().toISOString(),
    author: { "@type": "Person", name: `${site.name} Editorial Team` },
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: `${baseUrl}/posts/${slug}/`,
  };
  const faq = extractFaq(md);
  const faqLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  const missingAlt = /!\[\s*\]\(/.test(md);

  await setJobState(job.id, "seo_passed", {
    draftMd: md,
    title,
    slug,
    metaDescription,
    frontmatterJson: {
      jsonld: faqLd ? [articleLd, faqLd] : [articleLd],
      keywords: brief.outlineJson.keywords,
      missingAltText: missingAlt,
    },
  });
  await enqueueContentStage("MEDIA", job.id);
}

// ---------------------------------------------------------------------------
// MEDIA
// ---------------------------------------------------------------------------

async function stageMedia({ job, site }: JobContext): Promise<void> {
  const imagePolicy = site.contentPolicyJson.imagePolicy;
  let heroUrl: string | null = null;
  let altText = "";

  if (imagePolicy === "ai_generated" && replicateConfigured()) {
    heroUrl = await generateImage(
      `Editorial blog hero image for an article titled "${job.title}" on a ${site.niche} website. Clean, photographic, no text overlay.`,
    );
    altText = `Illustration: ${job.title}`;
  }
  // 'stock' policy: no stock provider wired in Phase 1a — publish without hero.

  if (heroUrl) {
    await db.insert(mediaAssets).values({
      siteId: site.id,
      jobId: job.id,
      kind: "ai_generated",
      storageUrl: heroUrl,
      altText,
      licenseJson: { provider: "replicate", model: "flux-schnell" },
    });
    await db
      .update(contentJobs)
      .set({
        frontmatterJson: { ...(job.frontmatterJson ?? {}), heroImage: heroUrl, heroAlt: altText },
      })
      .where(eq(contentJobs.id, job.id));
  }

  await setJobState(job.id, "media_attached");
  await enqueueContentStage("QUALITY_GATE", job.id);
}

// ---------------------------------------------------------------------------
// QUALITY_GATE
// ---------------------------------------------------------------------------

async function stageQualityGate(ctx: JobContext): Promise<void> {
  const { job, brief, site } = ctx;
  const scores = await runQualityGate(job, site);
  await db.update(contentJobs).set({ qualityScoresJson: scores }).where(eq(contentJobs.id, job.id));

  if (!scores.pass) {
    if (job.retryCount < 2) {
      const critique = [
        !scores.duplication.pass &&
          `Too similar (${scores.duplication.maxSimilarity}) to existing network article ${scores.duplication.nearestArticleId}. Take a substantially different angle.`,
        !scores.readability.pass &&
          `Readability too low (Flesch ${scores.readability.fleschReadingEase}). Use shorter sentences and simpler words.`,
        !scores.policy.pass &&
          `Policy violations: ${[...scores.policy.forbiddenTopicHits, scores.policy.ymylDetected ? "YMYL content on a non-YMYL site" : ""].filter(Boolean).join(", ")}. Remove this content entirely.`,
        scores.critic.issues.length > 0 && `Critic issues: ${scores.critic.issues.join("; ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      await db
        .update(contentBriefs)
        .set({ outlineJson: { ...brief.outlineJson, critique } })
        .where(eq(contentBriefs.id, brief.id));
      await setJobState(job.id, "briefed", { retryCount: job.retryCount + 1, critique });
      await enqueueContentStage("DRAFT", job.id);
      return;
    }
    // Max retries — escalate to mandatory human review regardless of policy.
    await setJobState(job.id, "in_review", { critique: "auto-retries exhausted; quality gate still failing" });
    await createAlert({
      siteId: site.id,
      severity: "medium",
      type: "QUALITY_ESCALATION",
      payload: { contentJobId: job.id, scores: { overall: scores.overall } },
    });
    return;
  }

  const route = routeReview(site, scores);
  await setJobState(job.id, route);
  if (route === "auto_approved") {
    await enqueueContentStage("PUBLISH", job.id);
  }
}

// ---------------------------------------------------------------------------
// PUBLISH
// ---------------------------------------------------------------------------

async function stagePublish(ctx: JobContext): Promise<void> {
  const { job, brief, site } = ctx;
  if (!["in_review", "auto_approved"].includes(job.state)) {
    throw new Error(`cannot publish from state ${job.state}`);
  }
  if (!job.draftMd || !job.slug || !job.title) throw new Error("job missing draft/slug/title");

  const fm = job.frontmatterJson ?? {};
  const body = stripFirstH1(job.draftMd);
  const payload = await staticBlogAdapter.transform(
    {
      kind: "article",
      title: job.title,
      slug: job.slug,
      description: job.metaDescription ?? "",
      bodyMarkdown: body,
      frontmatter: fm,
      mediaRefs: fm.heroImage ? [{ url: String(fm.heroImage), alt: String(fm.heroAlt ?? job.title) }] : [],
      policyTags: [],
    },
    { siteSlug: site.slug },
  );
  const receipt = await staticBlogAdapter.publish(payload);

  const vector = await embed(job.draftMd);
  const now = new Date();
  const isRefresh = brief.kind === "refresh";

  if (isRefresh) {
    await db
      .update(articles)
      .set({ title: job.title, frontmatterJson: fm, embedding: vector, lastRefreshedAt: now, jobId: job.id })
      .where(and(eq(articles.siteId, site.id), eq(articles.slug, job.slug)));
  } else {
    await db.insert(articles).values({
      siteId: site.id,
      jobId: job.id,
      slug: job.slug,
      title: job.title,
      frontmatterJson: fm,
      pathInRepo: receipt.externalRef,
      embedding: vector,
      publishedAt: now,
    });
  }

  await setJobState(job.id, "published", { publishedAt: now });
  await db.update(contentBriefs).set({ status: "completed" }).where(eq(contentBriefs.id, brief.id));

  // Index pings — best-effort.
  const fqdn = await siteFqdn(site);
  if (fqdn) {
    const url = `https://${fqdn}/posts/${job.slug}/`;
    if (config.INDEXNOW_KEY) {
      await fetch(
        `https://api.indexnow.org/indexnow?url=${encodeURIComponent(url)}&key=${config.INDEXNOW_KEY}`,
      ).catch(() => {});
    }
    if (gscConfigured()) {
      await submitSitemap(fqdn).catch(() => {});
    }
    await enqueueContentStage("INDEX_CHECK", job.id, { delayMs: 6 * 60 * 60 * 1000 });
  }
}

// ---------------------------------------------------------------------------
// INDEX_CHECK — poll GSC until the article is confirmed indexed
// ---------------------------------------------------------------------------

const MAX_INDEX_CHECKS = 14; // ~2 weeks at daily checks

async function stageIndexCheck(ctx: JobContext, bullJob: Job): Promise<void> {
  const { job, site } = ctx;
  if (job.state === "indexed") return;
  const fqdn = await siteFqdn(site);
  if (!fqdn || !gscConfigured()) return;

  const url = `https://${fqdn}/posts/${job.slug}/`;
  const status = await inspectUrl(fqdn, url).catch(() => "unknown" as const);

  if (status === "indexed") {
    const now = new Date();
    await db
      .update(articles)
      .set({ indexedAt: now })
      .where(and(eq(articles.siteId, site.id), eq(articles.slug, job.slug!)));
    await setJobState(job.id, "indexed");

    // live → indexed when the site crosses the configured threshold.
    if (site.state === "live") {
      const [countRow] = await db.execute<{ count: number }>(
        dsql`SELECT count(*)::int AS count FROM articles WHERE site_id = ${site.id} AND indexed_at IS NOT NULL`,
      );
      if (Number(countRow?.count ?? 0) >= config.INDEXED_PAGE_THRESHOLD) {
        await transitionSiteState(site.id, "indexed");
      }
    }
    return;
  }

  const attempt = Number((bullJob.data as ContentStagePayload & { attempt?: number }).attempt ?? 1);
  if (attempt >= MAX_INDEX_CHECKS) {
    await createAlert({
      siteId: site.id,
      severity: "medium",
      type: "QUALITY_ESCALATION",
      payload: { contentJobId: job.id, reason: `article not indexed after ${attempt} checks`, url },
    });
    return;
  }
  await ctxReenqueueIndexCheck(job.id, attempt + 1);
}

async function ctxReenqueueIndexCheck(contentJobId: string, attempt: number): Promise<void> {
  const { contentQueue } = await import("../jobs/queues.ts");
  await contentQueue.add(
    "INDEX_CHECK",
    { contentJobId, attempt },
    { delay: 24 * 60 * 60 * 1000, jobId: `INDEX_CHECK:${contentJobId}:${attempt}` },
  );
}

// ---------------------------------------------------------------------------
// CADENCE_TICK — scheduler entry: pull briefs from the backlog per cadence
// ---------------------------------------------------------------------------

async function stageCadenceTick(payload: CadenceTickPayload): Promise<void> {
  const site = await getSiteOrThrow(payload.siteId);
  const active = ["seeding", "live", "indexed", "adsense_applied", "adsense_approved", "monetized"];
  if (!active.includes(site.state)) return;

  const n = site.cadenceJson.articlesPerRun;

  // Re-use pending briefs first, then mint new ones from the keyword backlog.
  const pending = await db
    .select()
    .from(contentBriefs)
    .where(and(eq(contentBriefs.siteId, site.id), eq(contentBriefs.status, "pending")))
    .limit(n);
  let started = 0;
  for (const brief of pending) {
    await startContentJob(brief);
    started++;
  }

  if (started < n) {
    const used = await db
      .select({ clusterId: contentBriefs.clusterId })
      .from(contentBriefs)
      .where(eq(contentBriefs.siteId, site.id));
    const usedIds = new Set(used.map((u) => u.clusterId).filter(Boolean));
    const clusters = (await nextClusters(site.niche, n * 3)).filter((c) => !usedIds.has(c.id));
    for (const cluster of clusters.slice(0, n - started)) {
      const brief = await createBriefFromCluster(site, cluster);
      await startContentJob(brief);
      started++;
    }
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function processContent(bullJob: Job): Promise<void> {
  const stage = bullJob.name as ContentStage;
  if (stage === "CADENCE_TICK") {
    await stageCadenceTick(bullJob.data as CadenceTickPayload);
    return;
  }
  const ctx = await loadContext((bullJob.data as ContentStagePayload).contentJobId);
  try {
    switch (stage) {
      case "DRAFT":
        return await stageDraft(ctx);
      case "SEO_PASS":
        return await stageSeoPass(ctx);
      case "MEDIA":
        return await stageMedia(ctx);
      case "QUALITY_GATE":
        return await stageQualityGate(ctx);
      case "PUBLISH":
        return await stagePublish(ctx);
      case "INDEX_CHECK":
        return await stageIndexCheck(ctx, bullJob);
      default:
        throw new Error(`unknown content stage: ${stage}`);
    }
  } catch (err) {
    await db
      .update(contentJobs)
      .set({ error: `${stage}: ${(err as Error).message}` })
      .where(eq(contentJobs.id, ctx.job.id));
    throw err;
  }
}

export function startContentWorker(): Worker {
  return new Worker("content", processContent, { connection: redis, concurrency: 3 });
}
