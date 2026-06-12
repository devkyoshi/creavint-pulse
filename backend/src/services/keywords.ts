import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/client.ts";
import { keywordClusters, type KeywordCluster } from "../db/schema.ts";
import { keywordIdeas } from "../integrations/dataforseo/client.ts";
import { getLLM } from "../integrations/llm/claude.ts";
import { parseJsonResponse } from "../integrations/llm/provider.ts";
import { config } from "../config.ts";
import type { KeywordIdea } from "../types.ts";

interface ClusterDraft {
  label: string;
  keywords: string[];
  volume: number;
  difficulty: number;
  cpc: number;
}

/**
 * Refresh the keyword backlog for a niche: pull ideas, cluster by intent,
 * score opportunity = volume × (1/difficulty) × rpm_estimate, upsert.
 */
export async function refreshKeywordBacklog(niche: string): Promise<number> {
  const ideas = await keywordIdeas(niche, 40);
  if (ideas.length === 0) return 0;

  const clusters = getLLM().isConfigured() ? await llmCluster(niche, ideas) : naiveCluster(ideas);

  let upserted = 0;
  for (const c of clusters) {
    const difficulty = Math.max(1, Math.round(c.difficulty));
    const rpmEstimate = Math.round(c.cpc * 10 * 100) / 100; // crude CPC → RPM proxy
    const opportunityScore = Math.round(c.volume * (1 / difficulty) * Math.max(rpmEstimate, 0.5) * 100) / 100;
    await db
      .insert(keywordClusters)
      .values({
        niche,
        label: c.label,
        keywordsJson: c.keywords,
        volume: Math.round(c.volume),
        difficulty,
        rpmEstimate,
        opportunityScore,
      })
      .onConflictDoUpdate({
        target: [keywordClusters.niche, keywordClusters.label],
        set: {
          keywordsJson: c.keywords,
          volume: Math.round(c.volume),
          difficulty,
          rpmEstimate,
          opportunityScore,
        },
      });
    upserted++;
  }
  return upserted;
}

async function llmCluster(niche: string, ideas: KeywordIdea[]): Promise<ClusterDraft[]> {
  const res = await getLLM().complete({
    cheap: true,
    system:
      "You cluster SEO keywords by search intent. Respond with JSON only: " +
      '{"clusters":[{"label":string,"keywords":string[]}]}. Each cluster covers one article topic.',
    prompt: `Niche: ${niche}\nKeywords:\n${ideas.map((i) => i.keyword).join("\n")}`,
    maxTokens: 3000,
    temperature: 0.3,
  });
  const parsed = parseJsonResponse<{ clusters: { label: string; keywords: string[] }[] }>(res.text);
  const byKeyword = new Map(ideas.map((i) => [i.keyword.toLowerCase(), i]));
  return parsed.clusters
    .filter((c) => c.keywords.length > 0)
    .map((c) => {
      const members = c.keywords.map((k) => byKeyword.get(k.toLowerCase())).filter((m): m is KeywordIdea => !!m);
      const volume = members.reduce((s, m) => s + m.volume, 0) || 100;
      const difficulty = members.length
        ? members.reduce((s, m) => s + m.difficulty, 0) / members.length
        : 50;
      const cpc = members.length ? members.reduce((s, m) => s + m.cpc, 0) / members.length : 0.5;
      return { label: c.label, keywords: c.keywords, volume, difficulty, cpc };
    });
}

function naiveCluster(ideas: KeywordIdea[]): ClusterDraft[] {
  // Chunk by descending volume, 3 keywords per cluster, lead keyword as label.
  const sorted = [...ideas].sort((a, b) => b.volume - a.volume);
  const clusters: ClusterDraft[] = [];
  for (let i = 0; i < sorted.length; i += 3) {
    const members = sorted.slice(i, i + 3);
    clusters.push({
      label: members[0]!.keyword,
      keywords: members.map((m) => m.keyword),
      volume: members.reduce((s, m) => s + m.volume, 0),
      difficulty: members.reduce((s, m) => s + m.difficulty, 0) / members.length,
      cpc: members.reduce((s, m) => s + m.cpc, 0) / members.length,
    });
  }
  return clusters;
}

/** Next usable clusters for a niche, pinned first then by opportunity score. */
export async function nextClusters(niche: string, limit: number): Promise<KeywordCluster[]> {
  const rows = await db
    .select()
    .from(keywordClusters)
    .where(and(eq(keywordClusters.niche, niche), ne(keywordClusters.status, "banned")))
    .limit(200);
  return rows
    .sort((a, b) => {
      if (a.status === "pinned" && b.status !== "pinned") return -1;
      if (b.status === "pinned" && a.status !== "pinned") return 1;
      return b.opportunityScore - a.opportunityScore;
    })
    .slice(0, limit);
}
