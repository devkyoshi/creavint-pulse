# Creavint Pulse — Automated Content Monetization Platform

Internal staff tool. Provisions Hugo static-blog sites, runs AI content pipelines
(brief → draft → SEO → media → quality gate → review → publish → index), monitors
AdSense + GA4 + GSC, and feeds analytics back into content decisions.

## Layout

```
backend/          Fastify API + BullMQ workers + Drizzle schema (the platform)
hugo-templates/   Versioned Hugo theme packages (default-blog-v1)
sites/            Git content store (separate repo, generated at provision time)
docs/             Architecture + implementation specs
```

## Quick start

```bash
cp .env.example .env          # fill in API keys as available — everything degrades gracefully
pnpm install
docker compose up -d          # postgres:16 (pgvector) + redis:7
pnpm db:migrate               # tables + views + state-machine trigger
pnpm db:seed                  # admin user + default-blog-v1 template (linted)
pnpm dev                      # API on :3001, workers + scheduler inline
```

Login: `POST /api/auth/login` with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`,
defaults `admin@creavint.com` / `admin1234`).

## Backend scripts

```bash
pnpm --filter @creavint/backend dev          # API + inline workers (watch mode)
pnpm --filter @creavint/backend workers      # standalone worker process (set WORKERS_INLINE=false on the API)
pnpm --filter @creavint/backend typecheck
pnpm --filter @creavint/backend db:generate  # regenerate Drizzle migration from schema changes
```

## Integration behavior without credentials

The pilot runs end-to-end locally; each integration activates when its env vars are set:

| Missing credential | Behavior |
|---|---|
| `ANTHROPIC_API_KEY` | Trust pages fall back to Handlebars templates; content DRAFT jobs fail with a clear error |
| `DATAFORSEO_*` | Keyword backlog falls back to LLM ideas, then a deterministic stub |
| `EMBEDDINGS_API_KEY` | Deterministic hashed embeddings (dev-only duplication check) |
| `CLOUDFLARE_*`, `ORIGIN_VPS_*`, `GSC_SERVICE_ACCOUNT_JSON` | Provisioning steps recorded as `skipped`, site still reaches `seeding` |
| `GIT_REPO_URL` | Content store operates as a local-only git repo under `sites/` |

See `docs/creavint-pulse-summary.json` for the full spec and `CLAUDE.md` for engineering constraints.
