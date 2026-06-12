import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import { Worker, type Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { domains, provisionRuns, templates, type Site } from "../db/schema.ts";
import { redis } from "../jobs/queues.ts";
import type { ProvisioningPayload } from "../jobs/types.ts";
import { contentStore } from "../integrations/git/contentStore.ts";
import { cloudflareConfigured, ensureZone, upsertARecord } from "../integrations/cloudflare/client.ts";
import { addProperty, gscConfigured, submitSitemap } from "../integrations/google/gsc.ts";
import { runRemote, vpsConfigured, writeRemoteFile } from "../integrations/ssh/client.ts";
import { getLLM } from "../integrations/llm/claude.ts";
import { createBriefFromCluster, startContentJob } from "../services/briefs.ts";
import { nextClusters, refreshKeywordBacklog } from "../services/keywords.ts";
import { getSiteOrThrow, siteFqdn, transitionSiteState } from "../services/sites.ts";
import { createAlert } from "../services/alerts.ts";
import { PROVISION_STEPS, type ProvisionStep } from "../types.ts";

type StepResult = { status: "completed" | "skipped"; note?: string };
type StepFn = (site: Site, fqdn: string | null) => Promise<StepResult>;

const TRUST_PAGES: { slug: string; title: string }[] = [
  { slug: "about", title: "About Us" },
  { slug: "contact", title: "Contact" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "editorial-policy", title: "Editorial Policy" },
  { slug: "author", title: "Our Author" },
];

async function alreadyDone(siteId: string, step: ProvisionStep): Promise<boolean> {
  const [run] = await db
    .select()
    .from(provisionRuns)
    .where(and(eq(provisionRuns.siteId, siteId), eq(provisionRuns.step, step)))
    .limit(1);
  return run?.status === "completed" || run?.status === "skipped";
}

async function recordRun(
  siteId: string,
  step: ProvisionStep,
  status: "completed" | "failed" | "skipped",
  error?: string,
): Promise<void> {
  await db.insert(provisionRuns).values({
    siteId,
    step,
    status,
    error: error ?? null,
    finishedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const stepScaffold: StepFn = async (site, fqdn) => {
  const [template] = await db.select().from(templates).where(eq(templates.id, site.templateId!)).limit(1);
  if (!template) throw new Error("site has no registered template");
  const templateDir = path.join(config.hugoTemplatesPath, template.manifestJson.id);
  await contentStore.pull();
  const siteDir = contentStore.siteDir(site.slug);

  // Copy layouts/static/archetypes from the template package.
  fs.mkdirSync(siteDir, { recursive: true });
  for (const sub of ["layouts", "static", "archetypes"]) {
    const src = path.join(templateDir, sub);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(siteDir, sub), { recursive: true });
  }
  fs.mkdirSync(path.join(siteDir, "content", "posts"), { recursive: true });

  const params = {
    site: {
      name: site.name,
      slug: site.slug,
      niche: site.niche,
      baseUrl: fqdn ? `https://${fqdn}` : `https://${site.slug}.example.com`,
      gtmContainerId: site.gtmContainerId ?? "",
      adsenseClientId: site.adsenseClientId ?? "",
      titlePattern: site.seoDefaultsJson.titlePattern,
      defaultSchemaType: site.seoDefaultsJson.defaultSchemaType,
    },
    theme: site.themeConfigJson,
  };

  const configTpl = fs.readFileSync(path.join(templateDir, "config.toml.hbs"), "utf8");
  fs.writeFileSync(path.join(siteDir, "config.toml"), Handlebars.compile(configTpl)(params), "utf8");

  // ads.txt (placeholder until an AdSense client id exists)
  const adsTxtTpl = path.join(templateDir, "static", "ads.txt.hbs");
  const adsTxt = fs.existsSync(adsTxtTpl)
    ? Handlebars.compile(fs.readFileSync(adsTxtTpl, "utf8"))(params)
    : site.adsenseClientId
      ? `google.com, ${site.adsenseClientId}, DIRECT, f08c47fec0942fa0\n`
      : "# ads.txt — populated on AdSense approval\n";
  fs.mkdirSync(path.join(siteDir, "static"), { recursive: true });
  fs.writeFileSync(path.join(siteDir, "static", "ads.txt"), adsTxt, "utf8");
  fs.rmSync(path.join(siteDir, "static", "ads.txt.hbs"), { force: true });

  await contentStore.commitAndPush(`provision(${site.slug}): scaffold from ${template.manifestJson.id}`);
  return { status: "completed" };
};

const stepTrustPages: StepFn = async (site) => {
  const [template] = await db.select().from(templates).where(eq(templates.id, site.templateId!)).limit(1);
  const templateDir = path.join(config.hugoTemplatesPath, template!.manifestJson.id);
  const siteDir = contentStore.siteDir(site.slug);
  const llm = getLLM();

  for (const page of TRUST_PAGES) {
    const outPath = path.join(siteDir, "content", `${page.slug}.md`);
    if (fs.existsSync(outPath)) continue;

    let body: string | null = null;
    if (llm.isConfigured()) {
      try {
        const res = await llm.complete({
          cheap: true,
          system:
            "You write trust pages for content websites. Output clean markdown only, no frontmatter, no H1 (the title is separate). Be specific and credible, never use placeholder text.",
          prompt: `Write the "${page.title}" page for "${site.name}", a blog about ${site.niche}. Contact email: contact@${site.slug}.com. Keep it 200-400 words.`,
          maxTokens: 1500,
        });
        body = res.text.trim();
      } catch (e) {
        console.warn(`trust page LLM generation failed for ${page.slug}: ${(e as Error).message}`);
      }
    }
    if (!body) {
      const tplPath = path.join(templateDir, "content-templates", `${page.slug}.md.hbs`);
      body = Handlebars.compile(fs.readFileSync(tplPath, "utf8"))({
        site: { name: site.name, niche: site.niche, slug: site.slug },
      });
    }
    const frontmatter = `---\ntitle: "${page.title}"\nslug: "${page.slug}"\ndraft: false\n---\n\n`;
    fs.writeFileSync(outPath, frontmatter + body + "\n", "utf8");
  }

  await contentStore.commitAndPush(`provision(${site.slug}): trust pages`);
  return { status: "completed" };
};

const stepSeedBriefs: StepFn = async (site) => {
  let clusters = await nextClusters(site.niche, 18);
  if (clusters.length < 15) {
    await refreshKeywordBacklog(site.niche);
    clusters = await nextClusters(site.niche, 18);
  }
  if (clusters.length === 0) throw new Error(`no keyword clusters available for niche "${site.niche}"`);

  for (const cluster of clusters.slice(0, 18)) {
    const brief = await createBriefFromCluster(site, cluster);
    await startContentJob(brief, 1); // high priority — seed content
  }
  return { status: "completed", note: `${Math.min(clusters.length, 18)} seed briefs enqueued` };
};

const stepDns: StepFn = async (_site, fqdn) => {
  if (!fqdn) return { status: "skipped", note: "no domain assigned" };
  if (!cloudflareConfigured() || !config.ORIGIN_IP) {
    return { status: "skipped", note: "cloudflare/ORIGIN_IP not configured" };
  }
  const zone = await ensureZone(fqdn);
  await upsertARecord(zone.id, fqdn, config.ORIGIN_IP);
  return { status: "completed", note: `A record → ${config.ORIGIN_IP} (zone ${zone.name})` };
};

const stepTls: StepFn = async (_site, fqdn) => {
  if (!fqdn) return { status: "skipped", note: "no domain assigned" };
  if (!vpsConfigured()) return { status: "skipped", note: "origin VPS not configured" };
  await runRemote(
    `sudo certbot certonly --nginx --non-interactive --agree-tos -m admin@${fqdn} -d ${fqdn} || sudo certbot certonly --standalone --non-interactive --agree-tos -m admin@${fqdn} -d ${fqdn}`,
  );
  return { status: "completed" };
};

const stepWebServer: StepFn = async (site, fqdn) => {
  if (!fqdn || !vpsConfigured()) return { status: "skipped", note: "origin VPS not configured" };
  const vhost = `server {
  listen 80;
  listen 443 ssl;
  server_name ${fqdn};
  ssl_certificate /etc/letsencrypt/live/${fqdn}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${fqdn}/privkey.pem;
  root /var/www/${site.slug}/public;
  index index.html;
  location / { try_files $uri $uri/ =404; }
}
`;
  await writeRemoteFile(`${config.NGINX_VHOSTS_DIR}/${site.slug}.conf`, vhost);
  await runRemote(
    `sudo ln -sf ${config.NGINX_VHOSTS_DIR}/${site.slug}.conf /etc/nginx/sites-enabled/${site.slug}.conf && sudo nginx -t && sudo systemctl reload nginx`,
  );
  // First build is triggered by the git pushes above (CI on the content repo).
  return { status: "completed" };
};

const stepSearchWiring: StepFn = async (site, fqdn) => {
  if (!fqdn) return { status: "skipped", note: "no domain assigned" };
  if (!gscConfigured()) return { status: "skipped", note: "GSC service account not configured" };
  await addProperty(fqdn);
  await submitSitemap(fqdn);

  // Smoke test: GTM tag present on the live root page (best-effort).
  let note = "property registered, sitemap submitted";
  if (site.gtmContainerId) {
    try {
      const res = await fetch(`https://${fqdn}/`, { signal: AbortSignal.timeout(10_000) });
      const html = await res.text();
      note += html.includes(site.gtmContainerId) ? "; GTM tag verified" : "; GTM tag NOT found on root page";
    } catch {
      note += "; smoke test fetch failed (site may not be built yet)";
    }
  }
  return { status: "completed", note };
};

const stepStateTransition: StepFn = async (site) => {
  await transitionSiteState(site.id, "seeding");
  return { status: "completed" };
};

const STEP_FNS: Record<ProvisionStep, StepFn> = {
  SCAFFOLD: stepScaffold,
  TRUST_PAGES: stepTrustPages,
  SEED_BRIEFS: stepSeedBriefs,
  DNS: stepDns,
  TLS: stepTls,
  WEB_SERVER: stepWebServer,
  SEARCH_WIRING: stepSearchWiring,
  STATE_TRANSITION: stepStateTransition,
};

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function processProvisioning(job: Job<ProvisioningPayload>): Promise<void> {
  const { siteId } = job.data;
  let site = await getSiteOrThrow(siteId);

  if (site.state === "created" || site.state === "provisioning_failed" || site.state === "paused") {
    site = await transitionSiteState(siteId, "provisioning");
  }
  const fqdn = await siteFqdn(site);

  for (const step of PROVISION_STEPS) {
    if (await alreadyDone(siteId, step)) continue;
    try {
      const result = await STEP_FNS[step](site, fqdn);
      await recordRun(siteId, step, result.status, result.note);
      await job.log(`${step}: ${result.status}${result.note ? ` — ${result.note}` : ""}`);
    } catch (err) {
      const message = (err as Error).message;
      await recordRun(siteId, step, "failed", message);
      await transitionSiteState(siteId, "provisioning_failed").catch(() => {});
      await createAlert({
        siteId,
        severity: "high",
        type: "PROVISIONING_FAILED",
        payload: { step, error: message },
      });
      throw err; // let BullMQ retry; completed steps are skipped on resume
    }
    // refresh state between steps (STATE_TRANSITION changes it)
    site = await getSiteOrThrow(siteId);
  }
}

export function startProvisioningWorker(): Worker {
  return new Worker<ProvisioningPayload>("provisioning", processProvisioning, {
    connection: redis,
    concurrency: 2,
  });
}
