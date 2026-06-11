import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { keywordClusters } from "../db/schema.ts";
import { enqueueSeoJob } from "../jobs/enqueue.ts";
import { writeAudit } from "../services/audit.ts";

export default async function keywordRoutes(app: FastifyInstance) {
  // Backlog with opportunity scores
  app.get("/keywords", { preHandler: [app.authenticate] }, async (req) => {
    const { niche } = z.object({ niche: z.string().optional() }).parse(req.query);
    const base = db.select().from(keywordClusters);
    const rows = niche
      ? await base.where(eq(keywordClusters.niche, niche)).orderBy(desc(keywordClusters.opportunityScore))
      : await base.orderBy(desc(keywordClusters.opportunityScore)).limit(500);
    return rows;
  });

  // Pin / ban / reactivate a cluster
  app.post(
    "/keywords/:id/status",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { status } = z.object({ status: z.enum(["active", "pinned", "banned"]) }).parse(req.body);
      const [updated] = await db
        .update(keywordClusters)
        .set({ status })
        .where(eq(keywordClusters.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "cluster not found" });
      await writeAudit({
        actorId: req.user!.id,
        action: "keyword_cluster.status",
        entityType: "keyword_cluster",
        entityId: id,
        after: { status },
      });
      return updated;
    },
  );

  // Trigger a backlog refresh for a niche
  app.post(
    "/keywords/refresh",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req, reply) => {
      const { niche } = z.object({ niche: z.string().min(2) }).parse(req.body);
      await enqueueSeoJob("KEYWORD_REFRESH", { niche });
      return reply.code(202).send({ enqueued: true, niche });
    },
  );
}
