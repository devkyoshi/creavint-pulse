import { sql as dsql } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import type { ContentJob, Site } from "../db/schema.ts";
import { embed, toPgVector } from "../integrations/llm/embeddings.ts";
import { getLLM } from "../integrations/llm/claude.ts";
import { parseJsonResponse } from "../integrations/llm/provider.ts";
import { fleschReadingEase } from "../lib/readability.ts";
import { stripMarkdown } from "../lib/text.ts";
import type { QualityScores } from "../types.ts";

const YMYL_PATTERNS =
  /\b(diagnos\w+|prescri\w+|dosage|medical advice|cure[sd]?\b|treatment plan|invest(?:ing|ment) advice|stock picks|tax advice|legal advice|lawsuit|attorney|loan approval|credit repair)\b/i;

/**
 * Quality gate (§5.1 stage 5): duplication vs same site AND the whole
 * network, readability band, policy compliance + YMYL, LLM-as-critic rubric.
 */
export async function runQualityGate(job: ContentJob, site: Site): Promise<QualityScores> {
  const plain = stripMarkdown(job.draftMd ?? "");

  // --- duplication (pgvector cosine distance, cross-network) ---
  const vector = toPgVector(await embed(plain));
  const rows = await db.execute<{ id: string; similarity: number }>(
    dsql`SELECT id, 1 - (embedding <=> ${vector}::vector) AS similarity
         FROM articles
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> ${vector}::vector
         LIMIT 1`,
  );
  const nearest = rows[0];
  const maxSimilarity = Number(nearest?.similarity ?? 0);
  const duplication = {
    maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
    nearestArticleId: nearest?.id ?? null,
    pass: maxSimilarity < config.DUPLICATION_THRESHOLD,
  };

  // --- readability ---
  const flesch = fleschReadingEase(plain);
  const readability = { fleschReadingEase: flesch, pass: flesch >= 45 };

  // --- policy compliance ---
  const policy = site.contentPolicyJson;
  const lower = plain.toLowerCase();
  const forbiddenTopicHits = policy.forbiddenTopics.filter((t) => lower.includes(t.toLowerCase()));
  const ymylDetected = !policy.ymylEnabled && YMYL_PATTERNS.test(plain);
  const policyResult = {
    forbiddenTopicHits,
    ymylDetected,
    pass: forbiddenTopicHits.length === 0 && !ymylDetected,
  };

  // --- LLM-as-critic rubric ---
  const critic = await criticScore(job, site, plain);

  const overall = Math.round(
    (duplication.pass ? 25 : 0) +
      (readability.pass ? 15 : 5) +
      (policyResult.pass ? 20 : 0) +
      critic.score * 0.4,
  );
  const pass = duplication.pass && readability.pass && policyResult.pass && critic.pass;

  return { duplication, readability, policy: policyResult, critic, overall, pass };
}

async function criticScore(
  job: ContentJob,
  site: Site,
  plain: string,
): Promise<QualityScores["critic"]> {
  const llm = getLLM();
  if (!llm.isConfigured()) {
    // Heuristic stand-in: length within policy band + structure present.
    const words = plain.split(/\s+/).length;
    const inBand =
      words >= site.contentPolicyJson.wordCountMin * 0.8 &&
      words <= site.contentPolicyJson.wordCountMax * 1.3;
    const hasStructure = (job.draftMd?.match(/^##\s/gm)?.length ?? 0) >= 3;
    const score = (inBand ? 50 : 25) + (hasStructure ? 25 : 0);
    return { score, issues: ["LLM critic unavailable — heuristic score"], source: "heuristic", pass: score >= 60 };
  }
  const res = await llm.complete({
    cheap: true,
    system:
      "You are a strict content quality reviewer for a publishing network. Score the article 0-100 on " +
      "coherence, expertise signals, value density, and absence of fabricated/unverifiable claims. " +
      'Respond with JSON only: {"score": number, "issues": string[]}.',
    prompt: `Niche: ${site.niche}\nTarget tone: ${site.contentPolicyJson.tone}\n\nArticle:\n${(job.draftMd ?? "").slice(0, 20_000)}`,
    maxTokens: 1000,
    temperature: 0,
  });
  try {
    const parsed = parseJsonResponse<{ score: number; issues: string[] }>(res.text);
    const score = Math.max(0, Math.min(100, parsed.score));
    return { score, issues: parsed.issues ?? [], source: "llm", pass: score >= 60 };
  } catch {
    return { score: 50, issues: ["critic response unparsable"], source: "llm", pass: false };
  }
}

/**
 * Review routing per site policy (§5.1 stage 6). Sites in `seeding` or
 * `adsense_applied` always get mandatory review; auto mode keeps a ≥5% floor sample.
 */
export function routeReview(site: Site, scores: QualityScores): "in_review" | "auto_approved" {
  if (site.state === "seeding" || site.state === "adsense_applied") return "in_review";
  const policy = site.reviewPolicyJson;
  switch (policy.mode) {
    case "mandatory":
      return "in_review";
    case "sampled": {
      if (Math.random() < policy.sampleRate) return "in_review";
      return scores.overall >= policy.qualityScoreThreshold ? "auto_approved" : "in_review";
    }
    case "auto": {
      if (Math.random() < 0.05) return "in_review";
      return scores.overall >= policy.qualityScoreThreshold ? "auto_approved" : "in_review";
    }
  }
}
