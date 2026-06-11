import type { FastifyInstance } from "fastify";
import { and, desc, eq, gt, gte, lte, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { alerts, gscSnapshots } from "../db/schema.ts";
import { writeAudit } from "../services/audit.ts";

const RangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function analyticsRoutes(app: FastifyInstance) {
  // Network rollup — derived view (§4.2)
  app.get("/analytics/network", { preHandler: [app.authenticate] }, async (req) => {
    const q = { ...defaultRange(), ...RangeQuery.parse(req.query) };
    const rollup = await db.execute(
      dsql`SELECT * FROM network_rollup WHERE date BETWEEN ${q.from} AND ${q.to} ORDER BY date`,
    );
    const economics = await db.execute(
      dsql`SELECT site_id, site_name, state,
              sum(revenue_usd) AS revenue_usd,
              sum(content_cost_usd) AS content_cost_usd,
              sum(margin_usd) AS margin_usd
            FROM site_economics
            WHERE date BETWEEN ${q.from} AND ${q.to}
            GROUP BY site_id, site_name, state
            ORDER BY margin_usd DESC NULLS LAST`,
    );
    return { range: q, daily: rollup, sites: economics };
  });

  // Per-site economics
  app.get("/analytics/sites/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const q = { ...defaultRange(), ...RangeQuery.parse(req.query) };
    const rows = await db.execute(
      dsql`SELECT * FROM site_economics WHERE site_id = ${id} AND date BETWEEN ${q.from} AND ${q.to} ORDER BY date`,
    );
    return { range: q, daily: rows };
  });

  // Indexation trend (7-day rolling average view) — the early-warning chart
  app.get("/analytics/sites/:id/indexation", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const q = { ...defaultRange(), ...RangeQuery.parse(req.query) };
    const trend = await db.execute(
      dsql`SELECT * FROM indexation_trend WHERE site_id = ${id} AND date BETWEEN ${q.from} AND ${q.to} ORDER BY date`,
    );
    const raw = await db
      .select()
      .from(gscSnapshots)
      .where(and(eq(gscSnapshots.siteId, id), gte(gscSnapshots.date, q.from), lte(gscSnapshots.date, q.to)))
      .orderBy(gscSnapshots.date);
    return { range: q, trend, snapshots: raw };
  });

  // Reviewer throughput (admin/analyst dashboards)
  app.get("/analytics/reviewers", { preHandler: [app.authenticate, app.requireRole("analyst")] }, async () => {
    return db.execute(dsql`SELECT * FROM reviewer_throughput ORDER BY day DESC LIMIT 200`);
  });

  // --- Alert feed ---

  app.get("/alerts", { preHandler: [app.authenticate] }, async (req) => {
    const q = z.object({ unackedOnly: z.coerce.boolean().default(false) }).parse(req.query);
    const base = db.select().from(alerts);
    const rows = q.unackedOnly
      ? await base.where(dsql`${alerts.ackedBy} IS NULL`).orderBy(desc(alerts.createdAt)).limit(200)
      : await base.orderBy(desc(alerts.createdAt)).limit(200);
    return rows;
  });

  app.post("/alerts/:id/ack", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [updated] = await db
      .update(alerts)
      .set({ ackedBy: req.user!.id })
      .where(eq(alerts.id, id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "alert not found" });
    await writeAudit({ actorId: req.user!.id, action: "alert.ack", entityType: "alert", entityId: id });
    return updated;
  });

  // Real-time alert feed via Server-Sent Events (5s DB poll)
  app.get("/alerts/stream", { preHandler: [app.authenticate] }, async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(`: connected\n\n`);

    let lastSeen = new Date();
    const interval = setInterval(async () => {
      try {
        const fresh = await db
          .select()
          .from(alerts)
          .where(gt(alerts.createdAt, lastSeen))
          .orderBy(alerts.createdAt);
        for (const alert of fresh) {
          reply.raw.write(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`);
          lastSeen = alert.createdAt;
        }
      } catch (e) {
        app.log.error(e, "alert stream poll failed");
      }
    }, 5000);

    req.raw.on("close", () => clearInterval(interval));
  });
}
