import OpenAI from 'openai';
import { LLMProviderBase, type Completion } from './llm-base';
import type { AIResult, EmbeddingProvider, Prompt, Tier } from '../types';
import { AIError } from '../../errors';

/**
 * OpenAI and any OpenAI-compatible API (e.g. Google Gemini's free tier via its OpenAI endpoint).
 * `jsonMode: false` skips `response_format: json_object` for endpoints that don't document it; structured
 * output then relies on the base class's schema instructions + zod validation + one repair round.
 */
export class OpenAIProvider extends LLMProviderBase {
  readonly id: string;
  private client: OpenAI;
  private jsonMode: boolean;
  constructor(opts: { apiKey: string; main: string; fast: string; fallbacks?: string[]; client?: OpenAI; baseURL?: string; id?: string; jsonMode?: boolean }) {
    super({ main: opts.main, fast: opts.fast, fallbacks: opts.fallbacks });
    this.id = opts.id ?? 'openai';
    this.jsonMode = opts.jsonMode ?? true;
    this.client = opts.client ?? new OpenAI({ apiKey: opts.apiKey, ...(opts.baseURL ? { baseURL: opts.baseURL } : {}) });
  }
  protected async complete(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion> {
    const res = await this.client.chat.completions.create({
      model: opts.model ?? this.model(opts.tier),
      messages: [{ role: 'system', content: prompt.system }, ...prompt.messages],
      ...(opts.json && this.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0, estimated: !res.usage },
    };
  }
}
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;
  private client: OpenAI;
  constructor(readonly model: string, apiKey: string, client?: OpenAI, opts: { baseURL?: string; id?: string } = {}) {
    this.id = opts.id ?? 'openai';
    this.client = client ?? new OpenAI({ apiKey, ...(opts.baseURL ? { baseURL: opts.baseURL } : {}) });
  }
  async embed(texts: string[]): Promise<AIResult<number[][]>> {
    try {
      const res = await this.client.embeddings.create({ model: this.model, input: texts });
      return { value: res.data.map((d) => d.embedding), provider: this.id, model: this.model, usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: 0, estimated: false } };
    } catch (e) { throw new AIError(`${this.id} embeddings failed: ${e instanceof Error ? e.message : String(e)}`, this.id); }
  }
}
