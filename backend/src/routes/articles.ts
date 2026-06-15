import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { db } from "../db/client.ts";
import { articles, contentBriefs, contentJobs } from "../db/schema.ts";
import { getSiteOrThrow } from "../services/sites.ts";
import { internalLinkCandidates } from "../services/briefs.ts";
import { enqueueContentStage } from "../jobs/enqueue.ts";
import { extractTitle, slugify, deriveMetaDescription, truncate } from "../lib/text.ts";
import { writeAudit } from "../services/audit.ts";

const MAX_FILE_SIZE = 512 * 1024; // 512 KB

function parseFrontmatter(md: string): Record<string, string> {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch { /* malformed YAML — fall through */ }
  return {};
}

export default async function articlesRoutes(app: FastifyInstance) {
  /* ── POST /sites/:siteId/articles/upload ───────────────────────────────── */
  app.post(
    "/sites/:siteId/articles/upload",
    { preHandler: [app.authenticate, app.requireRole("site_manager", "admin")] },
    async (req, reply) => {
      const { siteId } = z.object({ siteId: z.string().uuid() }).parse(req.params);
      const site = await getSiteOrThrow(siteId);

      /* Read multipart */
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: "No file uploaded" });

      const buf = await data.toBuffer();
      if (buf.length > MAX_FILE_SIZE) {
        return reply.code(413).send({ error: "File must be under 512 KB" });
      }
      if (!data.filename.endsWith(".md") && data.mimetype !== "text/markdown") {
        return reply.code(422).send({ error: "Only .md files are accepted" });
      }

      const md = buf.toString("utf-8");

      /* Parse frontmatter + extract metadata */
      const fm = parseFrontmatter(md);
      const warnings: string[] = [];

      if (!Object.keys(fm).length) {
        warnings.push("No YAML frontmatter found — title and slug were inferred from content.");
      }

      const bodyWithoutFm = md.replace(/^---\n[\s\S]*?\n---\n?/, "");
      const rawTitle = fm.title ?? extractTitle(md) ?? "Untitled Article";
      const title = truncate(rawTitle, 60);

      let slug = fm.slug ?? slugify(rawTitle);
      if (!slug) slug = "untitled";

      const descriptionRaw = fm.description ?? deriveMetaDescription(bodyWithoutFm);
      if (!fm.description) {
        warnings.push("No description in frontmatter — derived from content. Review in SEO pass.");
      }

      /* Slug uniqueness check */
      const [existing] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(and(eq(articles.siteId, site.id), eq(articles.slug, slug)))
        .limit(1);
      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
        warnings.push(`Slug was already taken — renamed to "${slug}".`);
      }

      /* Fetch internal link candidates */
      const links = await internalLinkCandidates(siteId);

      /* Create stub brief (required by content job FK) */
      const [brief] = await db
        .insert(contentBriefs)
        .values({
          siteId,
          kind: "new",
          title,
          outlineJson: {
            targetKeyword: title,
            targetSlug: slug,
            keywords: fm.keywords ? (Array.isArray(fm.keywords) ? fm.keywords : [fm.keywords]) : [],
            intent: "informational",
            headings: [],
          },
          internalLinkCandidatesJson: links,
          status: "in_progress",
        })
        .returning();

      /* Create content job starting at "drafted" — skip the LLM DRAFT stage */
      const [job] = await db
        .insert(contentJobs)
        .values({
          briefId: brief!.id,
          siteId,
          draftMd: md,
          title,
          state: "drafted",
        })
        .returning();

      /* Enqueue SEO_PASS — normalises slug, meta description, JSON-LD, then quality gate */
      await enqueueContentStage("SEO_PASS", job!.id);

      await writeAudit({
        actorId: req.user!.id,
        action: "article.upload",
        entityType: "content_job",
        entityId: job!.id,
        after: { slug, title, warnings },
      });

      return { jobId: job!.id, slug, state: "drafted", warnings };
    },
  );

  /* ── PATCH /jobs/:jobId/draft ───────────────────────────────────────────── */
  app.patch(
    "/jobs/:jobId/draft",
    { preHandler: [app.authenticate, app.requireRole("site_manager", "content_reviewer", "admin")] },
    async (req, reply) => {
      const { jobId } = z.object({ jobId: z.string().uuid() }).parse(req.params);
      const { markdown, submit } = z.object({
        markdown: z.string().min(1),
        submit: z.boolean().optional().default(false),
      }).parse(req.body);

      const [job] = await db.select().from(contentJobs).where(eq(contentJobs.id, jobId)).limit(1);
      if (!job) return reply.code(404).send({ error: "Content job not found" });

      const [updated] = await db
        .update(contentJobs)
        .set(submit ? { draftMd: markdown, state: "in_review" } : { draftMd: markdown })
        .where(eq(contentJobs.id, jobId))
        .returning();

      await writeAudit({
        actorId: req.user!.id,
        action: submit ? "article.draft_submit" : "article.draft_save",
        entityType: "content_job",
        entityId: jobId,
        after: { submit },
      });

      return { jobId: updated!.id, state: updated!.state };
    },
  );
}
