import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  WORKERS_INLINE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  DATABASE_URL: z.string().default("postgresql://creavint:creavint@localhost:5432/creavint"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_SECRET: z.string().default("change_me_in_production"),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("cv_session"),

  SEED_ADMIN_EMAIL: z.string().default("admin@creavint.com"),
  SEED_ADMIN_PASSWORD: z.string().default("admin1234"),

  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_DEFAULT_MODEL: z.string().default("claude-sonnet-4-20250514"),
  LLM_CHEAP_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  EMBEDDINGS_API_URL: z.string().default("https://api.openai.com/v1/embeddings"),
  EMBEDDINGS_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().default("text-embedding-3-small"),

  REPLICATE_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),
  GSC_SERVICE_ACCOUNT_JSON: z.string().optional(),
  ADSENSE_PUBLISHER_ID: z.string().optional(),

  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  ORIGIN_IP: z.string().optional(),

  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),

  GIT_REPO_URL: z.string().optional(),
  GIT_SERVICE_ACCOUNT_KEY: z.string().optional(),

  ORIGIN_VPS_HOST: z.string().optional(),
  ORIGIN_VPS_USER: z.string().default("root"),
  ORIGIN_VPS_SSH_KEY: z.string().optional(),
  NGINX_VHOSTS_DIR: z.string().default("/etc/nginx/sites-available"),

  SLACK_WEBHOOK_URL: z.string().optional(),
  INDEXNOW_KEY: z.string().optional(),

  HUGO_BINARY_PATH: z.string().default("hugo"),
  SITES_REPO_LOCAL_PATH: z.string().default("./sites"),
  HUGO_TEMPLATES_PATH: z.string().default("./hugo-templates"),

  /** Indexed-page count (GSC) required for live → indexed transition. */
  INDEXED_PAGE_THRESHOLD: z.coerce.number().default(10),
  /** Week-over-week indexation drop (fraction) that triggers auto-pause. */
  INDEXATION_DROP_THRESHOLD: z.coerce.number().default(0.15),
  /** Cosine similarity at or above which the quality gate fails an article. */
  DUPLICATION_THRESHOLD: z.coerce.number().default(0.85),
});

const env = Env.parse(process.env);

// Paths in .env are relative to the repo root; the backend runs from backend/.
const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith("backend") ? ".." : ".");

export const config = {
  ...env,
  isProd: env.NODE_ENV === "production",
  sitesRepoLocalPath: path.resolve(repoRoot, env.SITES_REPO_LOCAL_PATH),
  hugoTemplatesPath: path.resolve(repoRoot, env.HUGO_TEMPLATES_PATH),
};

export type Config = typeof config;
