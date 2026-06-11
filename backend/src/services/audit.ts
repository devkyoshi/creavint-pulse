import { db } from "../db/client.ts";
import { auditLog } from "../db/schema.ts";

export async function writeAudit(opts: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLog).values({
    actorId: opts.actorId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId ?? null,
    beforeJson: opts.before ?? null,
    afterJson: opts.after ?? null,
  });
}
