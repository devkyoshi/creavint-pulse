import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { contentJobs, domains, provisionRuns, sites } from "../db/schema.ts";
import { enqueueProvisioning } from "../jobs/enqueue.ts";
import { adsenseChecklist } from "../services/checklist.ts";
import { createSite, getSiteOrThrow, transitionSiteState } from "../services/sites.ts";
import { createBriefFromCluster, startContentJob } from "../services/briefs.ts";
import { nextClusters } from "../services/keywords.ts";
import { writeAudit } from "../services/audit.ts";
import { SITE_TRANSITIONS } from "../lib/stateMachine.ts";

const CreateSiteBody = z.object({
  name: z.string().min(2),
  niche: z.string().min(2),
  domainId: z.string().uuid().optional(),
  fqdn: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i).optional(),
  templateId: z.string().uuid(),
  contentPolicy: z.object({
    tone: z.string(),
    persona: z.string().optional(),
    allowedTopics: z.array(z.string()).default([]),
    forbiddenTopics: z.array(z.string()).default([]),
    wordCountMin: z.number().int().min(200).default(800),
    wordCountMax: z.number().int().max(10_000).default(1800),
    imagePolicy: z.enum(["ai_generated", "stock", "none"]).default("none"),
    ymylEnabled: z.boolean().default(false),
  }),
  themeConfig: z.record(z.unknown()).default({}),
  seoDefaults: z.object({
    titlePattern: z.string().default("{title} | {siteName}"),
    defaultSchemaType: z.string().default("Article"),
  }),
  gtmContainerId: z.string().optional(),
  adsenseClientId: z.string().optional(),
  ga4PropertyId: z.string().optional(),
  reviewPolicy: z.object({
    mode: z.enum(["mandatory", "sampled", "auto"]).default("mandatory"),
    sampleRate: z.number().min(0).max(1).default(0.25),
    qualityScoreThreshold: z.number().min(0).max(100).default(75),
  }),
  cadence: z.object({
    cronExpression: z.string().default("0 9 * * *"),
    articlesPerRun: z.number().int().min(1).max(10).default(1),
  }),
});

const ManualBriefBody = z.object({
  clusterId: z.string().uuid().optional(),
  topic: z.string().optional(),
  count: z.number().int().min(1).max(10).default(1),
});

export default async function siteRoutes(app: FastifyInstance) {
  // Site wizard submit → site record + provisioning job
  app.post("/sites", { preHandler: [app.authenticate, app.requireRole("site_manager")] }, async (req, reply) => {
    const body = CreateSiteBody.parse(req.body);
    const site = await createSite(body, req.user!.id);
    const jobId = await enqueueProvisioning(site.id);
    return reply.code(201).send({ siteId: site.id, slug: site.slug, provisioningJobId: jobId });
  });

  app.get("/sites", { preHandler: [app.authenticate] }, async () => {
    return db
      .select({ site: sites, fqdn: domains.fqdn })
      .from(sites)
      .leftJoin(domains, eq(sites.domainId, domains.id))
      .orderBy(desc(sites.createdAt));
  });

  // Site detail incl. state machine, checklist, recent jobs, provisioning runs
  app.get("/sites/:id", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const site = await getSiteOrThrow(id);
    const [fqdnRow] = site.domainId
      ? await db.select({ fqdn: domains.fqdn }).from(domains).where(eq(domains.id, site.domainId)).limit(1)
      : [];
    const runs = await db
      .select()
      .from(provisionRuns)
      .where(eq(provisionRuns.siteId, id))
      .orderBy(desc(provisionRuns.startedAt))
      .limit(20);
    const recentJobs = await db
      .select()
      .from(contentJobs)
      .where(eq(contentJobs.siteId, id))
      .orderBy(desc(contentJobs.createdAt))
      .limit(20);
    const checklist = await adsenseChecklist(site);
    return {
      ...site,
      fqdn: fqdnRow?.fqdn ?? null,
      allowedTransitions: SITE_TRANSITIONS[site.state],
      provisionRuns: runs,
      recentJobs,
      adsenseChecklist: checklist,
    };
  });

  // Kill switch — site scope
  app.post(
    "/sites/:id/pause",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const site = await transitionSiteState(id, "paused", req.user!.id);
      return { id: site.id, state: site.state };
    },
  );

  app.post(
    "/sites/:id/resume",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const site = await transitionSiteState(id, "live", req.user!.id);
      return { id: site.id, state: site.state };
    },
  );

  app.get("/sites/:id/checklist", { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    return adsenseChecklist(await getSiteOrThrow(id));
  });

  // Human-gated AdSense application; validates checklist first (§6.3)
  app.post(
    "/sites/:id/adsense/apply",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const site = await getSiteOrThrow(id);
      const checklist = await adsenseChecklist(site);
      if (!checklist.pass) {
        return reply.code(422).send({
          error: "adsense checklist not satisfied",
          blocking: checklist.items.filter((i) => !i.pass),
        });
      }
      const updated = await transitionSiteState(id, "adsense_applied", req.user!.id);
      return { id: updated.id, state: updated.state };
    },
  );

  // Record the AdSense outcome (human action after Google responds)
  app.post(
    "/sites/:id/adsense/outcome",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = z.object({ approved: z.boolean(), reason: z.string().optional() }).parse(req.body);
      const to = body.approved ? "adsense_approved" : "adsense_rejected";
      const site = await transitionSiteState(id, to, req.user!.id);
      await writeAudit({
        actorId: req.user!.id,
        action: "site.adsense_outcome",
        entityType: "site",
        entityId: id,
        after: body,
      });
      return { id: site.id, state: site.state };
    },
  );

  // Manually add briefs / pin a topic → content jobs
  app.post(
    "/sites/:id/briefs",
    { preHandler: [app.authenticate, app.requireRole("site_manager")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = ManualBriefBody.parse(req.body);
      const site = await getSiteOrThrow(id);

      const clusters = body.clusterId
        ? await db.query.keywordClusters.findMany({ where: (kc, { eq: eq2 }) => eq2(kc.id, body.clusterId!) })
        : await nextClusters(body.topic ?? site.niche, body.count);
      if (clusters.length === 0) return reply.code(404).send({ error: "no keyword clusters available" });

      const jobIds: string[] = [];
      for (const cluster of clusters.slice(0, body.count)) {
        const brief = await createBriefFromCluster(site, cluster);
        jobIds.push(await startContentJob(brief));
      }
      return reply.code(201).send({ contentJobIds: jobIds });
    },
  );
}
