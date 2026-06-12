import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.ts";
import { getActiveProvider, getConfigValue } from "../../services/systemConfig.ts";
import { LLMNotConfiguredError, type CompleteOptions, type LLMProvider, type LLMResult } from "./provider.ts";
import { GeminiProvider } from "./gemini.ts";
import { GroqProvider } from "./groq.ts";

/** USD per million tokens: [input, output]. */
const PRICING: Record<string, [number, number]> = {
  "claude-sonnet-4-20250514": [3, 15],
  "claude-haiku-4-5-20251001": [1, 5],
};
const DEFAULT_PRICING: [number, number] = [3, 15];

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic | null = null;
  private apiKey: string | null = null;

  isConfigured(): boolean {
    return Boolean(this.apiKey ?? config.ANTHROPIC_API_KEY);
  }

  async loadKey(): Promise<void> {
    this.apiKey = await getConfigValue("anthropic_api_key");
  }

  private async getClient(): Promise<Anthropic> {
    if (!this.apiKey) await this.loadKey();
    const key = this.apiKey ?? config.ANTHROPIC_API_KEY;
    if (!key) throw new LLMNotConfiguredError();
    this.client ??= new Anthropic({ apiKey: key });
    return this.client;
  }

  async complete(opts: CompleteOptions): Promise<LLMResult> {
    const client = await this.getClient();
    const model = opts.model ?? (opts.cheap ? config.LLM_CHEAP_MODEL : config.LLM_DEFAULT_MODEL);
    const res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const [inPrice, outPrice] = PRICING[model] ?? DEFAULT_PRICING;
    const costUsd =
      (res.usage.input_tokens * inPrice + res.usage.output_tokens * outPrice) / 1_000_000;
    return {
      text,
      model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      costUsd,
    };
  }
}

let cachedProvider: LLMProvider = new ClaudeProvider();

export function getLLM(): LLMProvider {
  return cachedProvider;
}

/**
 * Re-reads the active LLM provider from system config and swaps the cached instance.
 * Called once at app startup and again whenever the admin updates `llm_provider`.
 */
export async function refreshLLMProvider(): Promise<void> {
  const providerName = await getActiveProvider("llm");
  if (providerName === "groq") {
    const p = new GroqProvider();
    await p.loadKey();
    cachedProvider = p;
  } else if (providerName === "gemini") {
    const p = new GeminiProvider();
    await p.loadKey();
    cachedProvider = p;
  } else {
    const p = new ClaudeProvider();
    await p.loadKey();
    cachedProvider = p;
  }
}
