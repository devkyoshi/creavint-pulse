import fs from "node:fs";
import path from "node:path";
import { db } from "../db/client.ts";
import { templates, type Template } from "../db/schema.ts";
import { config } from "../config.ts";
import { writeAudit } from "./audit.ts";
import type { TemplateManifest } from "../types.ts";

export interface LintResult {
  passed: boolean;
  checks: { name: string; pass: boolean; detail: string }[];
}

const REQUIRED_TRUST_PAGES = ["about", "contact", "privacy", "terms", "editorial-policy", "author"];

/**
 * Template lint (§4): trust pages, GTM/AdSense injection points, ads.txt
 * support, sitemap + RSS output, schema partial. A template that fails lint
 * cannot be registered.
 */
export function lintTemplate(templateDir: string, manifest: TemplateManifest): LintResult {
  const checks: LintResult["checks"] = [];
  const has = (...p: string[]) => fs.existsSync(path.join(templateDir, ...p));
  const read = (...p: string[]) => (has(...p) ? fs.readFileSync(path.join(templateDir, ...p), "utf8") : "");

  checks.push({
    name: "config_template",
    pass: has("config.toml.hbs"),
    detail: "config.toml.hbs present",
  });

  const missingTrust = REQUIRED_TRUST_PAGES.filter(
    (p) => !has("content-templates", `${p}.md.hbs`) && !has("content", `${p}.md`),
  );
  checks.push({
    name: "trust_pages",
    pass: missingTrust.length === 0,
    detail: missingTrust.length === 0 ? "all trust page templates present" : `missing: ${missingTrust.join(", ")}`,
  });

  const headPartial = read("layouts", "partials", "head.html");
  checks.push({
    name: "gtm_injection",
    pass: has("layouts", "partials", "gtm.html") || /gtm/i.test(headPartial),
    detail: "GTM partial / injection point",
  });
  checks.push({
    name: "adsense_injection",
    pass: has("layouts", "partials", "adsense.html") || /adsbygoogle|adsense/i.test(headPartial),
    detail: "AdSense partial / injection point",
  });
  checks.push({
    name: "schema_partial",
    pass: has("layouts", "partials", "schema.html"),
    detail: "schema.org JSON-LD partial",
  });

  const configToml = read("config.toml.hbs");
  checks.push({
    name: "sitemap_rss",
    pass: /sitemap/i.test(configToml) && /rss/i.test(configToml),
    detail: "sitemap + RSS output configured",
  });
  checks.push({
    name: "ads_txt",
    pass: has("static", "ads.txt.hbs") || has("static", "ads.txt"),
    detail: "ads.txt support",
  });
  checks.push({
    name: "manifest_pages",
    pass: REQUIRED_TRUST_PAGES.every((p) => manifest.requiredPages.includes(p)),
    detail: "manifest declares all required trust pages",
  });

  return { passed: checks.every((c) => c.pass), checks };
}

export async function registerTemplate(templateDirName: string, actorId: string): Promise<Template> {
  const templateDir = path.join(config.hugoTemplatesPath, templateDirName);
  const manifestPath = path.join(templateDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json not found in ${templateDirName}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as TemplateManifest;

  const lint = lintTemplate(templateDir, manifest);
  if (!lint.passed) {
    const failed = lint.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.detail}`);
    throw new Error(`template failed lint: ${failed.join("; ")}`);
  }

  const [template] = await db
    .insert(templates)
    .values({
      name: manifest.id,
      version: manifest.version,
      manifestJson: manifest,
      lintPassed: true,
      lintResultsJson: lint,
    })
    .onConflictDoUpdate({
      target: [templates.name, templates.version],
      set: { manifestJson: manifest, lintPassed: true, lintResultsJson: lint },
    })
    .returning();

  await writeAudit({
    actorId,
    action: "template.register",
    entityType: "template",
    entityId: template!.id,
    after: { name: manifest.id, version: manifest.version },
  });
  return template!;
}
