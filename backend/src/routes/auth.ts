import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { signSession } from "../middleware/auth.ts";
import { writeAudit } from "../services/audit.ts";

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
    if (!user || user.status !== "active" || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const token = signSession({ id: user.id, email: user.email, name: user.name, role: user.role });
    reply.setCookie(config.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProd,
      path: "/",
      domain: config.SESSION_COOKIE_DOMAIN || undefined,
      maxAge: 12 * 60 * 60,
    });
    await writeAudit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (req, reply) => {
    reply.clearCookie(config.SESSION_COOKIE_NAME, { path: "/" });
    await writeAudit({ actorId: req.user!.id, action: "auth.logout", entityType: "user", entityId: req.user!.id });
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (req) => req.user);
}
