import { getConfigValue } from "../../services/systemConfig.ts";
import { LLMNotConfiguredError, type CompleteOptions, type LLMProvider, type LLMResult } from "./provider.ts";

const BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const CHEAP_MODEL = "llama-3.1-8b-instant";

interface OpenAIMessage { role: string; content: string; }
interface OpenAIChoice { message: OpenAIMessage; }
interface OpenAIUsage { prompt_tokens: number; completion_tokens: number; }
interface OpenAIChatResponse { id: string; model: string; choices: OpenAIChoice[]; usage: OpenAIUsage; }

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private apiKey: string | null = null;

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async loadKey(): Promise<void> {
    this.apiKey = await getConfigValue("groq_api_key");
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
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    const body = (await res.json()) as OpenAIChatResponse;
    const text = body.choices[0]?.message.content ?? "";
    return {
      text,
      model: body.model,
      inputTokens: body.usage.prompt_tokens,
      outputTokens: body.usage.completion_tokens,
      costUsd: 0,
    };
  }
}

export { CHEAP_MODEL as GROQ_CHEAP_MODEL, DEFAULT_MODEL as GROQ_DEFAULT_MODEL };
