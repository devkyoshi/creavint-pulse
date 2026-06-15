import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { registerAuth } from "./middleware/auth.ts";
import authRoutes from "./routes/auth.ts";
import siteRoutes from "./routes/sites.ts";
import reviewRoutes from "./routes/review.ts";
import keywordRoutes from "./routes/keywords.ts";
import analyticsRoutes from "./routes/analytics.ts";
import adminRoutes from "./routes/admin.ts";
import articlesRoutes from "./routes/articles.ts";
import { InvalidTransitionError } from "./lib/stateMachine.ts";
import { refreshLLMProvider } from "./integrations/llm/claude.ts";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cookie);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 512 * 1024, files: 1 } });

  registerAuth(app);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "validation_failed", issues: err.issues });
    }
    if (err instanceof InvalidTransitionError) {
      return reply.code(409).send({ error: err.message });
    }
    if (/not found/i.test(err.message)) {
      return reply.code(404).send({ error: err.message });
    }
    app.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  app.get("/api/health", async () => ({ ok: true, service: "creavint-pulse-api" }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(siteRoutes);
      await api.register(reviewRoutes);
      await api.register(keywordRoutes);
      await api.register(analyticsRoutes);
      await api.register(adminRoutes);
      await api.register(articlesRoutes);
    },
    { prefix: "/api" },
  );

  // Warm the LLM provider cache from system config (non-fatal on DB unavailability at test time)
  await refreshLLMProvider().catch(() => {});

  return app;
}
