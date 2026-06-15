import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import bcrypt from "bcryptjs";
import unzipper from "unzipper";
import { and, count, desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { auditLog, domains, sites, templates, users } from "../db/schema.ts";
import { activateKillSwitch, killSwitchActive, releaseKillSwitch } from "../jobs/queues.ts";
import { lintTemplate, registerTemplate } from "../services/templates.ts";
import { writeAudit } from "../services/audit.ts";
import { createAlert } from "../services/alerts.ts";
import { getAllConfig, setConfigValue } from "../services/systemConfig.ts";
import { refreshLLMProvider } from "../integrations/llm/claude.ts";
import { config } from "../config.ts";
import { ROLES } from "../types.ts";
import type { TemplateManifest } from "../types.ts";

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
    const rows = await db
      .select({ ...getTableColumns(templates), sitesCount: count(sites.id) })
      .from(templates)
      .leftJoin(sites, eq(sites.templateId, templates.id))
      .groupBy(templates.id)
      .orderBy(desc(templates.createdAt));
    return rows;
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

  // Upload a Hugo template as a .zip file; extracts, lints, and registers it
  app.post("/admin/templates/upload", adminOnly, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });
    if (!data.filename.endsWith(".zip")) {
      return reply.code(422).send({ error: "Only .zip files are accepted" });
    }

    const tmpDir = path.join(os.tmpdir(), `creavint-template-${randomUUID()}`);
    await fsp.mkdir(tmpDir, { recursive: true });

    try {
      /* Extract zip */
      const buf = await data.toBuffer();
      await new Promise<void>((resolve, reject) => {
        const stream = unzipper.Extract({ path: tmpDir });
        stream.on("close", resolve);
        stream.on("error", reject);
        Readable.from(buf).pipe(stream);
      });

      /* Find manifest.json — may be at root or one level deep */
      let templateRoot = tmpDir;
      if (!fs.existsSync(path.join(tmpDir, "manifest.json"))) {
        const entries = await fsp.readdir(tmpDir, { withFileTypes: true });
        const subdir = entries.find((e) => e.isDirectory());
        if (subdir && fs.existsSync(path.join(tmpDir, subdir.name, "manifest.json"))) {
          templateRoot = path.join(tmpDir, subdir.name);
        } else {
          return reply.code(422).send({ error: "manifest.json not found in zip" });
        }
      }

      const manifest = JSON.parse(
        await fsp.readFile(path.join(templateRoot, "manifest.json"), "utf-8"),
      ) as TemplateManifest;

      /* Lint */
      const lint = lintTemplate(templateRoot, manifest);
      if (!lint.passed) {
        return reply.code(422).send({
          error: "Template failed lint checks",
          lint,
        });
      }

      /* Copy to hugo-templates/ */
      const destName = `${manifest.id}`;
      const destDir = path.join(config.hugoTemplatesPath, destName);
      if (fs.existsSync(destDir)) await fsp.rm(destDir, { recursive: true, force: true });
      await fsp.cp(templateRoot, destDir, { recursive: true });

      /* Register in DB using existing service */
      const template = await registerTemplate(destName, req.user!.id);
      return reply.code(201).send({ ...template, lint });
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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
