import { config } from "../../config.ts";
import { googleFetch, oauthConfigured, oauthToken } from "./auth.ts";

export function adsenseConfigured(): boolean {
  return oauthConfigured() && Boolean(config.ADSENSE_PUBLISHER_ID);
}

export interface AdsenseDomainRevenue {
  domain: string;
  revenueUsd: number;
  impressions: number;
  rpm: number;
}

/** Daily revenue split by domain, from the AdSense Management API v2. */
export async function pullDailyRevenue(date: string): Promise<AdsenseDomainRevenue[]> {
  const token = await oauthToken();
  const account = `accounts/${config.ADSENSE_PUBLISHER_ID}`;
  const [y, m, d] = date.split("-").map(Number);
  const params = new URLSearchParams({
    dateRange: "CUSTOM",
    "startDate.year": String(y),
    "startDate.month": String(m),
    "startDate.day": String(d),
    "endDate.year": String(y),
    "endDate.month": String(m),
    "endDate.day": String(d),
  });
  params.append("dimensions", "DOMAIN_NAME");
  for (const metric of ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSIONS_RPM"]) {
    params.append("metrics", metric);
  }
  const body = (await googleFetch(
    `https://adsense.googleapis.com/v2/${account}/reports:generate?${params}`,
    token,
  )) as { rows?: { cells: { value: string }[] }[] };
  return (body.rows ?? []).map((r) => ({
    domain: r.cells[0]?.value ?? "",
    revenueUsd: Number(r.cells[1]?.value ?? 0),
    impressions: Number(r.cells[2]?.value ?? 0),
    rpm: Number(r.cells[3]?.value ?? 0),
  }));
}
