import fs from "node:fs";
import { JWT, OAuth2Client } from "google-auth-library";
import { config } from "../../config.ts";

/**
 * Service-account auth (GSC + GA4). GSC_SERVICE_ACCOUNT_JSON may be either a
 * file path or the inline JSON itself.
 */
export function serviceAccountConfigured(): boolean {
  return Boolean(config.GSC_SERVICE_ACCOUNT_JSON);
}

function loadServiceAccount(): { client_email: string; private_key: string } {
  const raw = config.GSC_SERVICE_ACCOUNT_JSON!;
  const json = raw.trim().startsWith("{") ? raw : fs.readFileSync(raw, "utf8");
  return JSON.parse(json);
}

const clients = new Map<string, JWT>();

export function getServiceClient(scopes: string[]): JWT {
  const key = scopes.join(",");
  let client = clients.get(key);
  if (!client) {
    const sa = loadServiceAccount();
    client = new JWT({ email: sa.client_email, key: sa.private_key, scopes });
    clients.set(key, client);
  }
  return client;
}

export async function serviceAccountToken(scopes: string[]): Promise<string> {
  const { token } = await getServiceClient(scopes).getAccessToken();
  if (!token) throw new Error("failed to obtain google access token");
  return token;
}

/** OAuth user credentials — required by the AdSense Management API. */
export function oauthConfigured(): boolean {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_OAUTH_REFRESH_TOKEN);
}

export async function oauthToken(): Promise<string> {
  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: config.GOOGLE_OAUTH_REFRESH_TOKEN });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("failed to refresh google oauth token");
  return token;
}

export async function googleFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`google api ${res.status} ${url}: ${await res.text()}`);
  return (await res.json()) as T;
}
