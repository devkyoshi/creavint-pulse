import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import type { Role } from "../types.ts";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    requireRole: (...roles: Role[]) => preHandlerHookHandler;
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signSession(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role } satisfies TokenPayload, config.JWT_SECRET, {
    expiresIn: "12h",
  });
}

export function registerAuth(app: FastifyInstance) {
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[config.SESSION_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthenticated" });
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch {
      return reply.code(401).send({ error: "invalid session" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || user.status !== "active") return reply.code(401).send({ error: "unauthenticated" });
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  app.decorate("requireRole", (...roles: Role[]): preHandlerHookHandler => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.user) return reply.code(401).send({ error: "unauthenticated" });
      if (req.user.role !== "admin" && !roles.includes(req.user.role)) {
        return reply.code(403).send({ error: "forbidden", required: roles });
      }
    };
  });
}
