import { googleFetch, serviceAccountConfigured, serviceAccountToken } from "./auth.ts";

const SCOPE = ["https://www.googleapis.com/auth/webmasters"];

export function gscConfigured(): boolean {
  return serviceAccountConfigured();
}

function siteUrl(fqdn: string): string {
  return `sc-domain:${fqdn}`;
}

export async function addProperty(fqdn: string): Promise<void> {
  const token = await serviceAccountToken(SCOPE);
  await googleFetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl(fqdn))}`,
    token,
    { method: "PUT" },
  );
}

export async function submitSitemap(fqdn: string): Promise<void> {
  const token = await serviceAccountToken(SCOPE);
  const feed = encodeURIComponent(`https://${fqdn}/sitemap.xml`);
  await googleFetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl(fqdn))}/sitemaps/${feed}`,
    token,
    { method: "PUT" },
  );
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function queryAnalytics(opts: {
  fqdn: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit?: number;
}): Promise<SearchAnalyticsRow[]> {
  const token = await serviceAccountToken(SCOPE);
  const body = (await googleFetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl(opts.fqdn))}/searchAnalytics/query`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        startDate: opts.startDate,
        endDate: opts.endDate,
        dimensions: opts.dimensions,
        rowLimit: opts.rowLimit ?? 250,
      }),
    },
  )) as { rows?: SearchAnalyticsRow[] };
  return body.rows ?? [];
}

/**
 * Indexed-page proxy: distinct pages with ≥1 impression over the window.
 * (True index-coverage counts are not exposed by the GSC API.)
 */
export async function indexedPageCount(fqdn: string, startDate: string, endDate: string): Promise<number> {
  const rows = await queryAnalytics({ fqdn, startDate, endDate, dimensions: ["page"], rowLimit: 5000 });
  return rows.length;
}

export async function inspectUrl(fqdn: string, url: string): Promise<"indexed" | "not_indexed" | "unknown"> {
  const token = await serviceAccountToken(SCOPE);
  const body = (await googleFetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", token, {
    method: "POST",
    body: JSON.stringify({ inspectionUrl: url, siteUrl: siteUrl(fqdn) }),
  })) as { inspectionResult?: { indexStatusResult?: { coverageState?: string } } };
  const coverage = body.inspectionResult?.indexStatusResult?.coverageState ?? "";
  if (/submitted and indexed|indexed, not submitted/i.test(coverage)) return "indexed";
  if (coverage) return "not_indexed";
  return "unknown";
}
