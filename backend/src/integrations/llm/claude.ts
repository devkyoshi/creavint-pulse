import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.ts";
import { LLMNotConfiguredError, type CompleteOptions, type LLMProvider, type LLMResult } from "./provider.ts";

/** USD per million tokens: [input, output]. */
const PRICING: Record<string, [number, number]> = {
  "claude-sonnet-4-20250514": [3, 15],
  "claude-haiku-4-5-20251001": [1, 5],
};
const DEFAULT_PRICING: [number, number] = [3, 15];

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(config.ANTHROPIC_API_KEY);
  }

  private getClient(): Anthropic {
    if (!this.isConfigured()) throw new LLMNotConfiguredError();
    this.client ??= new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    return this.client;
  }

  async complete(opts: CompleteOptions): Promise<LLMResult> {
    const model = opts.model ?? config.LLM_DEFAULT_MODEL;
    const res = await this.getClient().messages.create({
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

let provider: ClaudeProvider | null = null;

export function getLLM(): LLMProvider {
  provider ??= new ClaudeProvider();
  return provider;
}
