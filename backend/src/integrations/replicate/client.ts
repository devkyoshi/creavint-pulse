import { config } from "../../config.ts";

export function replicateConfigured(): boolean {
  return Boolean(config.REPLICATE_API_KEY);
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
