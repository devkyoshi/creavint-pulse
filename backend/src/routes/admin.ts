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

/* ─── Preview HTML generator ─────────────────────────────────────────────── */
function generatePreviewHtml(manifest: TemplateManifest): string {
  const colorParam = manifest.parameters?.find(
    (p) => p.type === "color" && p.default,
  );
  const primary =
    typeof colorParam?.default === "string" ? colorParam.default : "#1a73e8";

  // Darken by replacing last hex pair for primary-dark approximation
  const primaryDark = primary; // used same; CSS handles hover darkening via opacity

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${manifest.name ?? manifest.id} — Preview</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--primary:${primary};--text:#1a1a2e;--text-muted:#5f6368;--text-light:#80868b;--bg:#fff;--bg-muted:#f8f9fa;--border:#e8eaed;--radius:8px;--sans:system-ui,-apple-system,"Segoe UI",sans-serif}
body{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.6;font-size:15px}
a{color:var(--primary);text-decoration:none}
header{background:var(--primary);padding:0 24px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.hi{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:56px;gap:24px}
.sn{font-size:20px;font-weight:700;color:#fff;letter-spacing:-.3px}
nav{display:flex;gap:4px}
nav a{color:rgba(255,255,255,.85);font-size:13.5px;font-weight:500;padding:6px 12px;border-radius:6px}
nav a:hover{background:rgba(255,255,255,.15);color:#fff}
.page{max-width:1100px;margin:0 auto;padding:32px 24px 64px}
.tag{display:inline-block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--primary);background:color-mix(in srgb,var(--primary) 10%,transparent);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent);padding:3px 9px;border-radius:99px}
.hero{display:grid;grid-template-columns:1fr 320px;gap:32px;align-items:center;padding:32px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px}
.hero-title{font-size:28px;font-weight:800;line-height:1.25;letter-spacing:-.5px;margin:12px 0 14px}
.hero-excerpt{color:var(--text-muted);font-size:15px;line-height:1.65;margin-bottom:20px;max-width:52ch}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:var(--radius)}
.hero-img{aspect-ratio:16/10;background:color-mix(in srgb,var(--primary) 12%,transparent);border-radius:12px;border:1px solid color-mix(in srgb,var(--primary) 18%,transparent);display:flex;align-items:center;justify-content:center;overflow:hidden}
.layout{display:grid;grid-template-columns:1fr 260px;gap:40px;align-items:start}
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.sh h2{font-size:17px;font-weight:700;letter-spacing:-.2px}
.sh a{font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.card-img{aspect-ratio:16/9;background:linear-gradient(135deg,var(--bg-muted),color-mix(in srgb,var(--primary) 8%,transparent));border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:center}
.ci-ph{width:36px;height:36px;border-radius:50%;background:color-mix(in srgb,var(--primary) 15%,transparent)}
.cb{padding:14px 16px 16px}
.ct{font-size:14.5px;font-weight:700;line-height:1.4;margin:8px 0;color:var(--text)}
.ce{font-size:13px;color:var(--text-muted);line-height:1.55;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cm{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-light)}
.av{width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--primary) 40%,transparent)}
.sidebar{display:flex;flex-direction:column;gap:24px}
.widget{background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--radius);padding:18px}
.widget h3{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:14px}
.wp{display:flex;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.wp:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.wt{width:52px;height:40px;border-radius:5px;flex-shrink:0;background:linear-gradient(135deg,var(--bg),color-mix(in srgb,var(--primary) 8%,transparent));border:1px solid var(--border)}
.wpt{font-size:13px;font-weight:600;line-height:1.4;color:var(--text)}
.wpd{font-size:11.5px;color:var(--text-light);margin-top:3px}
.tc{display:flex;flex-wrap:wrap;gap:7px}
.nl{background:color-mix(in srgb,var(--primary) 10%,transparent);border:1px solid color-mix(in srgb,var(--primary) 22%,transparent);border-radius:var(--radius);padding:18px;text-align:center}
.nl h3{font-size:14px;font-weight:700;margin-bottom:6px;color:var(--text)}
.nl p{font-size:12.5px;color:var(--text-muted);margin-bottom:12px;line-height:1.5}
.nl input{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;margin-bottom:8px;background:var(--bg);font-family:inherit}
.nl button{width:100%;padding:9px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;font-family:inherit}
footer{background:#1a1a2e;color:rgba(255,255,255,.65);margin-top:56px}
.fi{max-width:1100px;margin:0 auto;padding:36px 24px 24px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:32px}
footer h4{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.35);margin-bottom:12px}
footer ul{list-style:none;display:flex;flex-direction:column;gap:7px}
footer ul li a{color:rgba(255,255,255,.65);font-size:13.5px}
footer ul li a:hover{color:#fff}
.fb{max-width:1100px;margin:0 auto;padding:16px 24px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;font-size:12.5px}
</style>
</head>
<body>
<header><div class="hi">
  <span class="sn">${manifest.name ?? "My Blog"}</span>
  <nav><a href="#">Home</a><a href="#">Articles</a><a href="#">About</a><a href="#">Contact</a></nav>
</div></header>
<div class="page">
  <section class="hero">
    <div>
      <div><span class="tag">Featured</span></div>
      <h1 class="hero-title">How to Build a Scalable Content Strategy That Drives Organic Traffic</h1>
      <p class="hero-excerpt">Discover proven techniques for researching high-value keywords, structuring articles for SEO, and maintaining a publishing cadence that search engines reward.</p>
      <a class="btn" href="#">Read article →</a>
    </div>
    <div class="hero-img">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${primary}" stroke-width="1.2" opacity=".35"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
    </div>
  </section>
  <div class="layout">
    <main>
      <div class="sh"><h2>Latest Articles</h2><a href="#">View all →</a></div>
      <div class="grid">
        <article class="card"><div class="card-img"><div class="ci-ph"></div></div><div class="cb"><span class="tag">SEO</span><h3 class="ct">10 On-Page SEO Techniques That Still Work in 2025</h3><p class="ce">From title tag optimization to internal linking strategies, these fundamentals continue to move the needle.</p><div class="cm"><div class="av"></div><span>Jane Smith</span><span>·</span><span>5 min</span></div></div></article>
        <article class="card"><div class="card-img"><div class="ci-ph"></div></div><div class="cb"><span class="tag">Content</span><h3 class="ct">Writing for Both Readers and Search Engines Without Compromise</h3><p class="ce">How to strike the perfect balance between engaging prose and keyword-rich structure.</p><div class="cm"><div class="av"></div><span>Mark Lee</span><span>·</span><span>7 min</span></div></div></article>
        <article class="card"><div class="card-img"><div class="ci-ph"></div></div><div class="cb"><span class="tag">Analytics</span><h3 class="ct">Understanding Core Web Vitals and Their Impact on Rankings</h3><p class="ce">LCP, CLS, INP — what they measure, why Google cares, and how to improve each score.</p><div class="cm"><div class="av"></div><span>Sara Kim</span><span>·</span><span>6 min</span></div></div></article>
        <article class="card"><div class="card-img"><div class="ci-ph"></div></div><div class="cb"><span class="tag">Monetization</span><h3 class="ct">AdSense Approval Checklist: 20 Articles, Trust Pages, and CWV</h3><p class="ce">Everything you need before submitting for AdSense review — and common rejection reasons to avoid.</p><div class="cm"><div class="av"></div><span>Alex Chen</span><span>·</span><span>8 min</span></div></div></article>
      </div>
    </main>
    <aside class="sidebar">
      <div class="nl"><h3>Stay in the loop</h3><p>Weekly articles on SEO, content strategy, and monetization.</p><input type="email" placeholder="your@email.com" /><button>Subscribe →</button></div>
      <div class="widget"><h3>Popular</h3>
        <div class="wp"><div class="wt"></div><div><div class="wpt">The Long-Tail Keyword Guide for 2025</div><div class="wpd">Jun 8 · 5 min</div></div></div>
        <div class="wp"><div class="wt"></div><div><div class="wpt">Topical Authority: How to Dominate Your Niche</div><div class="wpd">Jun 2 · 9 min</div></div></div>
        <div class="wp"><div class="wt"></div><div><div class="wpt">E-E-A-T Signals That Actually Affect Rankings</div><div class="wpd">May 26 · 6 min</div></div></div>
      </div>
      <div class="widget"><h3>Topics</h3><div class="tc"><span class="tag">SEO</span><span class="tag">Content</span><span class="tag">Analytics</span><span class="tag">AdSense</span><span class="tag">Keywords</span><span class="tag">Technical SEO</span></div></div>
    </aside>
  </div>
</div>
<footer>
  <div class="fi">
    <div><div class="sn" style="font-size:17px;color:#fff;margin-bottom:8px">${manifest.name ?? "My Blog"}</div><p style="font-size:13px;line-height:1.6;max-width:30ch">In-depth articles on SEO, content marketing, and building profitable web properties.</p></div>
    <div><h4>Navigation</h4><ul><li><a href="#">Home</a></li><li><a href="#">Articles</a></li><li><a href="#">About</a></li><li><a href="#">Contact</a></li></ul></div>
    <div><h4>Legal</h4><ul><li><a href="#">Privacy Policy</a></li><li><a href="#">Terms of Service</a></li><li><a href="#">Editorial Policy</a></li></ul></div>
  </div>
  <div class="fb"><span>© 2025 ${manifest.name ?? "My Blog"}. All rights reserved.</span><div style="display:flex;gap:16px"><a href="#" style="color:rgba(255,255,255,.5)">Privacy</a><a href="#" style="color:rgba(255,255,255,.5)">Terms</a></div></div>
</footer>
</body>
</html>`;
}

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

  // Scaffold a new template by cloning the default-blog-v1 base
  app.post("/admin/templates/scaffold", adminOnly, async (req, reply) => {
    const paramSchema = z.object({
      key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
      label: z.string().min(1),
      type: z.enum(["string", "color", "url", "boolean", "number"]),
      required: z.boolean().optional(),
      default: z.union([z.string(), z.boolean(), z.number()]).optional(),
    });
    const body = z
      .object({
        name: z.string().regex(/^[a-z0-9-]+$/),
        displayName: z.string().min(1),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
        parameters: z.array(paramSchema).default([]),
      })
      .parse(req.body);

    /* Check uniqueness */
    const [existing] = await db
      .select({ id: templates.id })
      .from(templates)
      .where(eq(templates.name, body.name))
      .limit(1);
    if (existing) {
      return reply.code(422).send({ error: `Template "${body.name}" already exists` });
    }

    /* Locate base template */
    const baseName = "default-blog-v1";
    const basePath = path.join(config.hugoTemplatesPath, baseName);
    if (!fs.existsSync(basePath)) {
      return reply.code(422).send({ error: `Base template "${baseName}" not found on server` });
    }

    const destPath = path.join(config.hugoTemplatesPath, body.name);
    try {
      /* Copy base */
      await fsp.cp(basePath, destPath, { recursive: true });

      /* Read base manifest for requiredPages */
      const baseManifest = JSON.parse(
        await fsp.readFile(path.join(basePath, "manifest.json"), "utf-8"),
      ) as TemplateManifest;

      /* Write new manifest */
      const newManifest: TemplateManifest = {
        id: body.name,
        name: body.displayName,
        version: body.version,
        parameters: body.parameters,
        requiredPages: baseManifest.requiredPages,
      };
      await fsp.writeFile(
        path.join(destPath, "manifest.json"),
        JSON.stringify(newManifest, null, 2),
        "utf-8",
      );

      /* Generate and write preview.html */
      await fsp.writeFile(
        path.join(destPath, "preview.html"),
        generatePreviewHtml(newManifest),
        "utf-8",
      );

      /* Lint — always passes since base passes and we kept all required files */
      const lint = lintTemplate(destPath, newManifest);
      if (!lint.passed) {
        await fsp.rm(destPath, { recursive: true, force: true }).catch(() => {});
        return reply.code(422).send({ error: "Scaffolded template failed lint", lint });
      }

      const template = await registerTemplate(body.name, req.user!.id);
      return reply.code(201).send(template);
    } catch (e) {
      await fsp.rm(destPath, { recursive: true, force: true }).catch(() => {});
      throw e;
    }
  });

  // Serve a template's preview.html (or a generated fallback)
  app.get(
    "/admin/templates/:id/preview",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const [template] = await db
        .select()
        .from(templates)
        .where(eq(templates.id, id))
        .limit(1);
      if (!template) return reply.code(404).send({ error: "Template not found" });

      const previewFile = path.join(config.hugoTemplatesPath, template.name, "preview.html");
      if (fs.existsSync(previewFile)) {
        const html = await fsp.readFile(previewFile, "utf-8");
        return reply.type("text/html").send(html);
      }

      /* Fallback: generate from manifest */
      const html = generatePreviewHtml(
        template.manifestJson as TemplateManifest,
      );
      return reply.type("text/html").send(html);
    },
  );

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
