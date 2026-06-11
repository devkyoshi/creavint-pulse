import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.ts";
import { db, sql } from "./client.ts";
import { templates, users } from "./schema.ts";
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

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
