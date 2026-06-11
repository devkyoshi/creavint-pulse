import { googleFetch, serviceAccountConfigured, serviceAccountToken } from "./auth.ts";

const SCOPE = ["https://www.googleapis.com/auth/analytics.readonly"];

export function ga4Configured(): boolean {
  return serviceAccountConfigured();
}

export interface Ga4DailyMetrics {
  date: string;
  sessions: number;
  users: number;
  engagementRate: number;
}

export async function pullDailyMetrics(propertyId: string, date: string): Promise<Ga4DailyMetrics> {
  const token = await serviceAccountToken(SCOPE);
  const body = (await googleFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate: date, endDate: date }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagementRate" }],
      }),
    },
  )) as { rows?: { metricValues: { value: string }[] }[] };
  const row = body.rows?.[0]?.metricValues ?? [];
  return {
    date,
    sessions: Number(row[0]?.value ?? 0),
    users: Number(row[1]?.value ?? 0),
    engagementRate: Number(row[2]?.value ?? 0),
  };
}
