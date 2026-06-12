import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { auditLog, domains, templates, users } from "../db/schema.ts";
import { activateKillSwitch, killSwitchActive, releaseKillSwitch } from "../jobs/queues.ts";
import { registerTemplate } from "../services/templates.ts";
import { writeAudit } from "../services/audit.ts";
import { createAlert } from "../services/alerts.ts";
import { getAllConfig, setConfigValue } from "../services/systemConfig.ts";
import { refreshLLMProvider } from "../integrations/llm/claude.ts";
import { ROLES } from "../types.ts";

export default async function adminRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [app.authenticate, app.requireRole("admin")] };

  // --- Domain pool ---

  app.get("/admin/domains", { preHandler: [app.authenticate, app.requireRole("site_manager")] }, async () => {
    return db.select().from(domains).orderBy(desc(domains.status));
  });

  app.post("/admin/domains", adminOnly, async (req, reply) => {
    const body = z
      .object({
        fqdn: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
        registrar: z.string().optional(),
        isAged: z.boolean().default(false),
        historyCheck: z.record(z.unknown()).optional(),
      })
      .parse(req.body);
    if (body.isAged && !body.historyCheck) {
      // Domain pool hygiene (§13.8): aged domains require a recorded history check.
      return reply.code(422).send({ error: "aged domains require a historyCheck record" });
    }
    const [domain] = await db
      .insert(domains)
      .values({
        fqdn: body.fqdn.toLowerCase(),
        registrar: body.registrar ?? null,
        isAged: body.isAged,
        historyCheckJson: body.historyCheck ?? null,
        acquiredAt: new Date(),
      })
      .returning();
    await writeAudit({
      actorId: req.user!.id,
      action: "domain.add",
      entityType: "domain",
      entityId: domain!.id,
      after: { fqdn: body.fqdn },
    });
    return reply.code(201).send(domain);
  });

  // --- Template registry ---

  app.get("/admin/templates", { preHandler: [app.authenticate] }, async () => {
    return db.select().from(templates).orderBy(desc(templates.createdAt));
  });

  // Registers a template from hugo-templates/<dir>; runs lint, rejects on failure
  app.post("/admin/templates", adminOnly, async (req, reply) => {
    const { templateDir } = z.object({ templateDir: z.string().regex(/^[a-z0-9-]+$/) }).parse(req.body);
    try {
      const template = await registerTemplate(templateDir, req.user!.id);
      return reply.code(201).send(template);
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });

  // --- Users ---

  app.get("/admin/users", adminOnly, async () => {
    return db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
      .from(users);
  });

  app.post("/admin/users", adminOnly, async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.enum(ROLES),
        password: z.string().min(8),
      })
      .parse(req.body);
    const [user] = await db
      .insert(users)
      .values({
        email: body.email.toLowerCase(),
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 10),
      })
      .returning();
    await writeAudit({
      actorId: req.user!.id,
      action: "user.create",
      entityType: "user",
      entityId: user!.id,
      after: { email: body.email, role: body.role },
    });
    return reply.code(201).send({ id: user!.id, email: user!.email, role: user!.role });
  });

  app.patch("/admin/users/:id", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ role: z.enum(ROLES).optional(), status: z.enum(["active", "disabled"]).optional() })
      .parse(req.body);
    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) return reply.code(404).send({ error: "user not found" });
    const [updated] = await db.update(users).set(body).where(eq(users.id, id)).returning();
    await writeAudit({
      actorId: req.user!.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      before: { role: before.role, status: before.status },
      after: body,
    });
    return { id: updated!.id, role: updated!.role, status: updated!.status };
  });

  // --- Network kill switch ---

  app.get("/admin/kill-switch", adminOnly, async () => {
    const activeSince = await killSwitchActive();
    return { active: Boolean(activeSince), since: activeSince };
  });

  app.post("/admin/kill-switch", adminOnly, async (req) => {
    const { action } = z.object({ action: z.enum(["pause", "resume"]) }).parse(req.body);
    if (action === "pause") {
      await activateKillSwitch();
      await createAlert({
        severity: "critical",
        type: "KILL_SWITCH",
        payload: { action: "network_pause", by: req.user!.email },
      });
    } else {
      await releaseKillSwitch();
    }
    await writeAudit({
      actorId: req.user!.id,
      action: `kill_switch.${action}`,
      entityType: "network",
    });
    return { active: action === "pause" };
  });

  // --- Audit log ---

  app.get("/admin/audit-log", adminOnly, async (req) => {
    const q = z
      .object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);
    const base = db.select().from(auditLog);
    if (q.entityType && q.entityId) {
      return base
        .where(and(eq(auditLog.entityType, q.entityType), eq(auditLog.entityId, q.entityId)))
        .orderBy(desc(auditLog.at))
        .limit(q.limit);
    }
    return base.orderBy(desc(auditLog.at)).limit(q.limit);
  });

  // --- System configuration ---

  app.get("/admin/config", adminOnly, async () => {
    return getAllConfig();
  });

  app.patch("/admin/config/:key", adminOnly, async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value } = z.object({ value: z.string().nullable() }).parse(req.body);
    await setConfigValue(key, value, req.user!.id);
    if (key === "llm_provider") await refreshLLMProvider();
    return reply.send({ ok: true });
  });
}
