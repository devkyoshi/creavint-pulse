import { config } from "../../config.ts";

const API = "https://api.cloudflare.com/client/v4";

interface CfResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json()) as CfResponse<T>;
  if (!body.success) {
    throw new Error(`cloudflare error: ${body.errors.map((e) => `${e.code} ${e.message}`).join("; ")}`);
  }
  return body.result;
}

export function cloudflareConfigured(): boolean {
  return Boolean(config.CLOUDFLARE_API_TOKEN && config.CLOUDFLARE_ACCOUNT_ID);
}

interface Zone {
  id: string;
  name: string;
  status: string;
}

export async function ensureZone(fqdn: string): Promise<Zone> {
  // Apex zone for the fqdn (e.g. blog.example.com → example.com)
  const apex = fqdn.split(".").slice(-2).join(".");
  const existing = await cf<Zone[]>(`/zones?name=${encodeURIComponent(apex)}`);
  if (existing.length > 0) return existing[0]!;
  return cf<Zone>("/zones", {
    method: "POST",
    body: JSON.stringify({ name: apex, account: { id: config.CLOUDFLARE_ACCOUNT_ID }, type: "full" }),
  });
}

export async function upsertARecord(zoneId: string, fqdn: string, ip: string): Promise<void> {
  const records = await cf<{ id: string }[]>(
    `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fqdn)}`,
  );
  const payload = JSON.stringify({ type: "A", name: fqdn, content: ip, ttl: 1, proxied: true });
  if (records.length > 0) {
    await cf(`/zones/${zoneId}/dns_records/${records[0]!.id}`, { method: "PUT", body: payload });
  } else {
    await cf(`/zones/${zoneId}/dns_records`, { method: "POST", body: payload });
  }
}

export async function zoneActive(zoneId: string): Promise<boolean> {
  const zone = await cf<Zone>(`/zones/${zoneId}`);
  return zone.status === "active";
}
