import { config } from "../../config.ts";
import { getLLM } from "../llm/claude.ts";
import { parseJsonResponse } from "../llm/provider.ts";
import type { KeywordIdea } from "../../types.ts";

export function dataforseoConfigured(): boolean {
  return Boolean(config.DATAFORSEO_LOGIN && config.DATAFORSEO_PASSWORD);
}

/**
 * Keyword ideas for a niche. Prefers DataForSEO; falls back to an LLM
 * estimate when DataForSEO is not configured (pilot/dev), and finally to a
 * deterministic stub so the pipeline never blocks.
 */
export async function keywordIdeas(niche: string, limit = 40): Promise<KeywordIdea[]> {
  if (dataforseoConfigured()) return dataforseoIdeas(niche, limit);
  if (getLLM().isConfigured()) return llmIdeas(niche, limit);
  return stubIdeas(niche, limit);
}

async function dataforseoIdeas(niche: string, limit: number): Promise<KeywordIdea[]> {
  const auth = Buffer.from(`${config.DATAFORSEO_LOGIN}:${config.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { keywords: [niche], location_code: 2840, language_code: "en", limit },
    ]),
  });
  if (!res.ok) throw new Error(`dataforseo ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    tasks?: {
      result?: {
        items?: {
          keyword: string;
          keyword_info?: { search_volume?: number; cpc?: number };
          keyword_properties?: { keyword_difficulty?: number };
        }[];
      }[];
    }[];
  };
  const items = body.tasks?.[0]?.result?.[0]?.items ?? [];
  return items.map((i) => ({
    keyword: i.keyword,
    volume: i.keyword_info?.search_volume ?? 0,
    difficulty: i.keyword_properties?.keyword_difficulty ?? 50,
    cpc: i.keyword_info?.cpc ?? 0,
  }));
}

async function llmIdeas(niche: string, limit: number): Promise<KeywordIdea[]> {
  const res = await getLLM().complete({
    model: config.LLM_CHEAP_MODEL,
    system:
      "You are an SEO keyword research assistant. Respond with JSON only: " +
      '{"keywords":[{"keyword":string,"volume":number,"difficulty":number,"cpc":number}]}. ' +
      "volume is estimated monthly US searches, difficulty is 0-100, cpc is USD.",
    prompt: `Suggest ${limit} long-tail, low-competition blog keywords for the niche "${niche}". Favor informational intent suitable for display-ad monetization.`,
    maxTokens: 4000,
    temperature: 0.5,
  });
  const parsed = parseJsonResponse<{ keywords: KeywordIdea[] }>(res.text);
  return parsed.keywords.slice(0, limit);
}

function stubIdeas(niche: string, limit: number): KeywordIdea[] {
  const patterns = [
    `best ${niche} for beginners`,
    `how to start with ${niche}`,
    `${niche} tips and tricks`,
    `common ${niche} mistakes`,
    `${niche} buying guide`,
    `${niche} on a budget`,
    `is ${niche} worth it`,
    `${niche} for small spaces`,
    `${niche} maintenance checklist`,
    `${niche} trends this year`,
  ];
  return patterns.slice(0, limit).map((keyword, i) => ({
    keyword,
    volume: 500 - i * 30,
    difficulty: 20 + i * 3,
    cpc: 0.5,
  }));
}
