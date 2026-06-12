import { eq } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { systemConfig } from "../db/schema.ts";
import { writeAudit } from "./audit.ts";

const MASKED = "***SET***";

const ENV_FALLBACK: Record<string, () => string | undefined> = {
  anthropic_api_key:   () => config.ANTHROPIC_API_KEY,
  replicate_api_key:   () => config.REPLICATE_API_KEY,
  dataforseo_login:    () => config.DATAFORSEO_LOGIN,
  dataforseo_password: () => config.DATAFORSEO_PASSWORD,
  embeddings_api_key:  () => config.EMBEDDINGS_API_KEY,
  embeddings_api_url:  () => config.EMBEDDINGS_API_URL,
  groq_api_key:        () => config.GROQ_API_KEY,
  gemini_api_key:      () => config.GEMINI_API_KEY,
  pexels_api_key:      () => config.PEXELS_API_KEY,
  unsplash_access_key: () => config.UNSPLASH_ACCESS_KEY,
  serper_api_key:      () => config.SERPER_API_KEY,
  llm_provider:        () => (config.ANTHROPIC_API_KEY ? "claude" : config.GROQ_API_KEY ? "groq" : config.GEMINI_API_KEY ? "gemini" : undefined),
  image_provider:      () => (config.REPLICATE_API_KEY ? "replicate" : config.PEXELS_API_KEY ? "pexels" : config.UNSPLASH_ACCESS_KEY ? "unsplash" : undefined),
  keywords_provider:   () => (config.DATAFORSEO_LOGIN ? "dataforseo" : config.SERPER_API_KEY ? "serper" : undefined),
  embeddings_provider: () => (config.EMBEDDINGS_API_KEY ? "openai" : "local"),
};

export interface SystemConfigRow {
  key: string;
  category: string;
  label: string;
  description: string | null;
  value: string | null;
  isSecret: boolean;
  updatedAt: string;
  source: "db" | "env" | "unset";
}

/** Returns all rows with secret values masked. */
export async function getAllConfig(): Promise<SystemConfigRow[]> {
  const rows = await db.select().from(systemConfig);
  return rows.map((r) => {
    const envVal = ENV_FALLBACK[r.key]?.();
    const source = r.value != null ? "db" : envVal ? "env" : "unset";
    const isConfigured = r.value != null || Boolean(envVal);
    return {
      key: r.key,
      category: r.category,
      label: r.label,
      description: r.description,
      value: r.isSecret ? (isConfigured ? MASKED : null) : (r.value ?? envVal ?? null),
      isSecret: r.isSecret,
      updatedAt: r.updatedAt.toISOString(),
      source,
    };
  });
}

/** Returns the real (unmasked) value for a key. DB takes priority over env var. */
export async function getConfigValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  if (row?.value != null) return row.value;
  return ENV_FALLBACK[key]?.() ?? null;
}

/** Upserts a config value and writes an audit entry. Pass null to clear. */
export async function setConfigValue(key: string, value: string | null, actorId: string): Promise<void> {
  await db
    .insert(systemConfig)
    .values({ key, category: "custom", label: key, value, updatedBy: actorId })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value, updatedBy: actorId, updatedAt: new Date() },
    });
  await writeAudit({
    actorId,
    action: "config.set",
    entityType: "system_config",
    entityId: key,
    after: { key, hasValue: value != null },
  });
}

/** Returns the active provider name for a category (e.g. 'llm', 'image'). */
export async function getActiveProvider(category: string): Promise<string> {
  const key = `${category}_provider`;
  return (await getConfigValue(key)) ?? "none";
}
