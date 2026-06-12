import { getConfigValue } from "../../services/systemConfig.ts";
import type { KeywordIdea } from "../../types.ts";

interface SerperOrganicResult {
  title: string;
  snippet: string;
  link: string;
}

interface SerperResponse {
  organic: SerperOrganicResult[];
}

export async function serperConfigured(): Promise<boolean> {
  return Boolean(await getConfigValue("serper_api_key"));
}

/**
 * Returns keyword ideas derived from Serper.dev SERP results.
 * Volume and difficulty are not available from SERP data — they default to 0.
 * Free tier: 2,500 searches/month at serper.dev.
 */
export async function serperIdeas(niche: string, limit: number): Promise<KeywordIdea[]> {
  const apiKey = await getConfigValue("serper_api_key");
  if (!apiKey) return [];

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: `${niche} tips how to best`, num: Math.min(limit, 10) }),
  });

  if (!res.ok) {
    console.warn(`serper ${res.status}: ${await res.text()}`);
    return [];
  }

  const body = (await res.json()) as SerperResponse;
  const results = body.organic ?? [];

  return results.slice(0, limit).map((r) => {
    const title = r.title ?? "";
    const keyword = title.replace(/\s*[-|–]\s*.*$/, "").trim().toLowerCase().slice(0, 80) || niche;
    return {
      keyword,
      volume: 0,
      difficulty: 0,
      cpc: 0,
    };
  });
}
