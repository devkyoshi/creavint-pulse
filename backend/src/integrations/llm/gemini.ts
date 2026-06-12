import { getConfigValue } from "../../services/systemConfig.ts";
import { LLMNotConfiguredError, type CompleteOptions, type LLMProvider, type LLMResult } from "./provider.ts";

// Gemini exposes an OpenAI-compatible endpoint
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-2.5-flash";
const CHEAP_MODEL = "gemini-2.0-flash";

interface OpenAIMessage { role: string; content: string; }
interface OpenAIChoice { message: OpenAIMessage; }
interface OpenAIUsage { prompt_tokens: number; completion_tokens: number; }
interface OpenAIChatResponse { model: string; choices: OpenAIChoice[]; usage: OpenAIUsage; }

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private apiKey: string | null = null;

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async loadKey(): Promise<void> {
    this.apiKey = await getConfigValue("gemini_api_key");
  }

  async complete(opts: CompleteOptions): Promise<LLMResult> {
    if (!this.apiKey) await this.loadKey();
    if (!this.apiKey) throw new LLMNotConfiguredError();

    const model = opts.cheap ? CHEAP_MODEL : (opts.model ?? DEFAULT_MODEL);
    const messages: OpenAIMessage[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: opts.prompt });

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const body = (await res.json()) as OpenAIChatResponse;
    const text = body.choices[0]?.message.content ?? "";
    return {
      text,
      model: body.model ?? model,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      costUsd: 0,
    };
  }
}

export { CHEAP_MODEL as GEMINI_CHEAP_MODEL, DEFAULT_MODEL as GEMINI_DEFAULT_MODEL };
