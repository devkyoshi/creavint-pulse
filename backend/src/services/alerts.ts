import { db } from "../db/client.ts";
import { alerts } from "../db/schema.ts";
import { config } from "../config.ts";
import type { AlertSeverity, AlertType } from "../types.ts";

export async function createAlert(opts: {
  siteId?: string | null;
  severity: AlertSeverity;
  type: AlertType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(alerts).values({
    siteId: opts.siteId ?? null,
    severity: opts.severity,
    type: opts.type,
    payloadJson: opts.payload ?? {},
  });

  if ((opts.severity === "high" || opts.severity === "critical") && config.SLACK_WEBHOOK_URL) {
    await fetch(config.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:rotating_light: *${opts.type}* (${opts.severity})${opts.siteId ? ` — site ${opts.siteId}` : ""}\n\`\`\`${JSON.stringify(opts.payload ?? {}, null, 2)}\`\`\``,
      }),
    }).catch((e) => console.warn(`slack notify failed: ${e.message}`));
  }
}
