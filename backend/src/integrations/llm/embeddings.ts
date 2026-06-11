import crypto from "node:crypto";
import { config } from "../../config.ts";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Returns a 1536-dim embedding. Uses the configured OpenAI-compatible
 * endpoint when EMBEDDINGS_API_KEY is set; otherwise falls back to a
 * deterministic hashed bag-of-ngrams vector — adequate for catching
 * near-duplicates in dev, NOT for production semantic similarity.
 */
export async function embed(text: string): Promise<number[]> {
  if (config.EMBEDDINGS_API_KEY) {
    const res = await fetch(config.EMBEDDINGS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.EMBEDDINGS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.EMBEDDINGS_MODEL,
        input: text.slice(0, 30_000),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    if (!res.ok) throw new Error(`embeddings API ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { data: { embedding: number[] }[] };
    const vec = body.data[0]?.embedding;
    if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`embeddings API returned unexpected dimensions (${vec?.length})`);
    }
    return vec;
  }
  return localEmbedding(text);
}

function localEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const grams: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) grams.push(`${words[i]} ${words[i + 1]}`);
  for (const g of grams) {
    const h = crypto.createHash("sha1").update(g).digest();
    const idx = h.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = h[4]! % 2 === 0 ? 1 : -1;
    vec[idx]! += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
