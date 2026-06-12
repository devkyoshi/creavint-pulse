import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.ts";
import { db, sql } from "./client.ts";
import { systemConfig, templates, users } from "./schema.ts";
import { lintTemplate } from "../services/templates.ts";
import type { TemplateManifest } from "../types.ts";

async function main() {
  // --- admin user ---
  const email = config.SEED_ADMIN_EMAIL.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing) {
    await db.insert(users).values({
      email,
      name: "Admin",
      role: "admin",
      passwordHash: await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 10),
    });
    console.log(`seeded admin user: ${email}`);
  } else {
    console.log(`admin user already exists: ${email}`);
  }

  // --- default template (registered through the same lint as the API) ---
  const templateDirName = "default-blog-v1";
  const templateDir = path.join(config.hugoTemplatesPath, templateDirName);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(templateDir, "manifest.json"), "utf8"),
  ) as TemplateManifest;
  const lint = lintTemplate(templateDir, manifest);
  if (!lint.passed) {
    throw new Error(
      `default template failed lint: ${lint.checks.filter((c) => !c.pass).map((c) => c.name).join(", ")}`,
    );
  }
  await db
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
    });
  console.log(`seeded template: ${manifest.id}@${manifest.version} (lint passed)`);

  // --- system config defaults ---
  const configDefaults: Array<typeof systemConfig.$inferInsert> = [
    { key: "llm_provider",       category: "llm",        label: "Active LLM provider",    description: "claude | groq | gemini", isSecret: false },
    { key: "anthropic_api_key",  category: "llm",        label: "Anthropic API key",       description: "Required for Claude provider", isSecret: true },
    { key: "groq_api_key",       category: "llm",        label: "Groq API key",            description: "Free tier: llama-3.3-70b-versatile. Get one at console.groq.com", isSecret: true },
    { key: "gemini_api_key",     category: "llm",        label: "Google Gemini API key",   description: "Free tier: gemini-2.5-flash. Get one at aistudio.google.com", isSecret: true },
    { key: "llm_default_model",  category: "llm",        label: "Default model override",  description: "Leave blank to use provider default", isSecret: false },
    { key: "image_provider",     category: "image",      label: "Active image provider",   description: "replicate | pexels | unsplash", isSecret: false },
    { key: "replicate_api_key",  category: "image",      label: "Replicate API key",       description: "For AI-generated images", isSecret: true },
    { key: "pexels_api_key",     category: "image",      label: "Pexels API key",          description: "Free stock photos. Get one at pexels.com/api", isSecret: true },
    { key: "unsplash_access_key",category: "image",      label: "Unsplash access key",     description: "Free stock photos. Get one at unsplash.com/developers", isSecret: true },
    { key: "keywords_provider",  category: "keywords",   label: "Active keywords provider",description: "dataforseo | serper | llm", isSecret: false },
    { key: "dataforseo_login",   category: "keywords",   label: "DataForSEO login",        description: "Email login for DataForSEO API", isSecret: true },
    { key: "dataforseo_password",category: "keywords",   label: "DataForSEO password",     description: "Password for DataForSEO API", isSecret: true },
    { key: "serper_api_key",     category: "keywords",   label: "Serper.dev API key",      description: "Free tier: 2500 searches/month. Get one at serper.dev", isSecret: true },
    { key: "embeddings_provider",category: "embeddings", label: "Embeddings provider",     description: "openai | huggingface | local", isSecret: false },
    { key: "embeddings_api_key", category: "embeddings", label: "Embeddings API key",      description: "Key for the embeddings endpoint", isSecret: true },
    { key: "embeddings_api_url", category: "embeddings", label: "Embeddings endpoint URL", description: "OpenAI-compatible embeddings URL. Default: OpenAI", isSecret: false },
  ];
  for (const row of configDefaults) {
    await db.insert(systemConfig).values(row).onConflictDoNothing();
  }
  console.log(`seeded ${configDefaults.length} system config defaults`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
