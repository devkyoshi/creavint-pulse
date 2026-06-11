import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { contentBriefs, contentJobs, reviews, sites } from "../db/schema.ts";
import { submitReview } from "../services/review.ts";

const ReviewBody = z.object({
  decision: z.enum(["approve", "reject", "edit"]),
  reasons: z.array(z.string()).optional(),
  editedContent: z.string().optional(),
});

export default async function reviewRoutes(app: FastifyInstance) {
  // Content desk queue — jobs awaiting human review
  app.get(
    "/review-queue",
    { preHandler: [app.authenticate, app.requireRole("content_reviewer", "site_manager")] },
    async (req) => {
      const query = z
        .object({
          siteId: z.string().uuid().optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(25),
        })
        .parse(req.query);

      const where = query.siteId
        ? and(eq(contentJobs.state, "in_review"), eq(contentJobs.siteId, query.siteId))
        : eq(contentJobs.state, "in_review");

      const rows = await db
        .select({
          job: contentJobs,
          siteName: sites.name,
          siteSlug: sites.slug,
        })
        .from(contentJobs)
        .innerJoin(sites, eq(contentJobs.siteId, sites.id))
        .where(where)
        .orderBy(desc(contentJobs.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      return rows.map((r) => ({
        id: r.job.id,
        siteId: r.job.siteId,
        siteName: r.siteName,
        siteSlug: r.siteSlug,
        title: r.job.title,
        qualityScores: r.job.qualityScoresJson,
        critique: r.job.critique,
        retryCount: r.job.retryCount,
        createdAt: r.job.createdAt,
      }));
    },
  );

  // Full article + brief + quality scores for the review pane
  app.get(
    "/jobs/:id/article",
    { preHandler: [app.authenticate, app.requireRole("content_reviewer", "site_manager", "analyst")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const [job] = await db.select().from(contentJobs).where(eq(contentJobs.id, id)).limit(1);
      if (!job) return reply.code(404).send({ error: "job not found" });
      const [brief] = await db.select().from(contentBriefs).where(eq(contentBriefs.id, job.briefId)).limit(1);
      const jobReviews = await db.select().from(reviews).where(eq(reviews.jobId, id)).orderBy(desc(reviews.at));
      return { job, brief, reviews: jobReviews };
    },
  );

  // Approve | reject | edit (+ structured reasons that feed prompt improvement)
  app.post(
    "/jobs/:id/review",
    { preHandler: [app.authenticate, app.requireRole("content_reviewer")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = ReviewBody.parse(req.body);
      const job = await submitReview(id, req.user!.id, body);
      return { id: job.id, state: job.state };
    },
  );
}
