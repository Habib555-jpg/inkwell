import OpenAI from 'openai';
import { LLMProviderBase, type Completion } from './llm-base';
import type { AIResult, EmbeddingProvider, Prompt, Tier } from '../types';
import { AIError } from '../../errors';

export class OpenAIProvider extends LLMProviderBase {
  readonly id = 'openai';
  private client: OpenAI;
  constructor(opts: { apiKey: string; main: string; fast: string; client?: OpenAI }) {
    super({ main: opts.main, fast: opts.fast });
    this.client = opts.client ?? new OpenAI({ apiKey: opts.apiKey });
  }
  protected async complete(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion> {
    const res = await this.client.chat.completions.create({
      model: opts.model ?? this.model(opts.tier),
      messages: [{ role: 'system', content: prompt.system }, ...prompt.messages],
      ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0, estimated: !res.usage },
    };
  }
}
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai';
  private client: OpenAI;
  constructor(readonly model: string, apiKey: string, client?: OpenAI) { this.client = client ?? new OpenAI({ apiKey }); }
  async embed(texts: string[]): Promise<AIResult<number[][]>> {
    try {
      const res = await this.client.embeddings.create({ model: this.model, input: texts });
      return { value: res.data.map((d) => d.embedding), provider: this.id, model: this.model, usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: 0, estimated: false } };
    } catch (e) { throw new AIError(`OpenAI embeddings failed: ${e instanceof Error ? e.message : String(e)}`, this.id); }
  }
}
