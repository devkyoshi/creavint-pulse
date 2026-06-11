export interface LLMResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CompleteOptions {
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(opts: CompleteOptions): Promise<LLMResult>;
}

export class LLMNotConfiguredError extends Error {
  constructor() {
    super("no LLM provider configured (set ANTHROPIC_API_KEY)");
    this.name = "LLMNotConfiguredError";
  }
}

/** Parse a JSON object out of an LLM response that may wrap it in prose/fences. */
export function parseJsonResponse<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in LLM response");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
