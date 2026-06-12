import { config } from "../../config.ts";
import { getActiveProvider, getConfigValue } from "../../services/systemConfig.ts";
import { pexelsConfigured, searchPexels } from "../pexels/client.ts";
import { searchUnsplash, unsplashConfigured } from "../unsplash/client.ts";

export async function replicateConfigured(): Promise<boolean> {
  const key = await getConfigValue("replicate_api_key");
  return Boolean(key ?? config.REPLICATE_API_KEY);
}

/**
 * Generate an image via Replicate (flux-schnell) and return its hosted URL.
 * Returns null when generation fails or times out — media is best-effort.
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const res = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
      Prefer: "wait=30",
    },
    body: JSON.stringify({ input: { prompt, aspect_ratio: "16:9", output_format: "webp" } }),
  });
  if (!res.ok) {
    console.warn(`replicate ${res.status}: ${await res.text()}`);
    return null;
  }
  let prediction = (await res.json()) as { id: string; status: string; output?: string[] | string };

  for (let i = 0; i < 20 && !["succeeded", "failed", "canceled"].includes(prediction.status); i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${config.REPLICATE_API_KEY}` },
    });
    prediction = (await poll.json()) as typeof prediction;
  }
  if (prediction.status !== "succeeded") return null;
  return Array.isArray(prediction.output) ? (prediction.output[0] ?? null) : (prediction.output ?? null);
}

export interface ResolvedImage {
  url: string;
  kind: "ai_generated" | "stock";
  license: object | null;
}

/**
 * Resolves an image for a content job based on the site's image policy and the
 * active image provider from system config.
 * Waterfall: configured provider → fallback stock → null (best-effort).
 */
export async function resolveImage(
  prompt: string,
  policy: "ai_generated" | "stock" | "none",
): Promise<ResolvedImage | null> {
  if (policy === "none") return null;

  const provider = await getActiveProvider("image");

  if (policy === "stock" || provider === "pexels" || provider === "unsplash") {
    if (await pexelsConfigured()) {
      const r = await searchPexels(prompt);
      if (r) return { url: r.url, kind: "stock", license: r.license };
    }
    if (await unsplashConfigured()) {
      const r = await searchUnsplash(prompt);
      if (r) return { url: r.url, kind: "stock", license: r.license };
    }
    if (policy === "stock") return null;
  }

  if (await replicateConfigured()) {
    const url = await generateImage(prompt);
    if (url) return { url, kind: "ai_generated", license: null };
  }

  return null;
}
