import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { LLMProviderBase, type Completion } from './llm-base';
import type { Prompt, Tier, TokenUsage } from '../types';
import { AIError } from '../../errors';

const supportsAdaptiveThinking = (model: string) => !model.startsWith('claude-haiku');
/** Models that accept the server-side refusal fallback; other models never receive it. */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-opus-5-5', 'claude-fable-5-1']);
export type ServerFallback = 'default' | 'off';

export class AnthropicProvider extends LLMProviderBase {
  readonly id = 'anthropic';
  private client: Anthropic;
  private serverFallback: ServerFallback;
  constructor(opts: { apiKey: string; main: string; fast: string; serverFallback?: ServerFallback; client?: Anthropic }) {
    super({ main: opts.main, fast: opts.fast });
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });
    this.serverFallback = opts.serverFallback ?? 'default';
  }
  private usage(u: { input_tokens: number; output_tokens: number }): TokenUsage {
    return { inputTokens: u.input_tokens, outputTokens: u.output_tokens, estimated: false };
  }
  private mapError(e: unknown): never {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError('Anthropic API key was rejected. Check ANTHROPIC_API_KEY.', this.id);
    if (e instanceof Anthropic.RateLimitError) throw new AIError('Anthropic rate limit reached. Please retry shortly.', this.id);
    if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic API error ${e.status}: ${e.message}`, this.id);
    throw new AIError(`Anthropic request failed: ${e instanceof Error ? e.message : String(e)}`, this.id);
  }
  protected async complete(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion> {
    const model = opts.model ?? this.model(opts.tier);
    const params = {
      model,
      max_tokens: opts.tier === 'main' ? 64000 : Math.min(opts.maxTokens, 16000),
      system: prompt.system,
      messages: prompt.messages,
      cache_control: { type: 'ephemeral' as const },
      ...(supportsAdaptiveThinking(model) ? { thinking: { type: 'adaptive' as const } } : {}),
    };
    try {
      // Streaming + finalMessage() avoids HTTP timeouts on long chapter outputs.
      const msg = this.serverFallback === 'default' && SERVER_FALLBACK_MODELS.has(model)
        ? await this.client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never).finalMessage()
        : await this.client.messages.stream(params as never).finalMessage();
      if (msg.stop_reason === 'refusal') throw new AIError('The model declined this request. Try rephrasing the chapter instructions.', this.id);
      const text = (msg.content as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      return { text, usage: this.usage(msg.usage) };
    } catch (e) { this.mapError(e); }
  }
  protected async completeStructured<T>(prompt: Prompt, schema: z.ZodType<T>, tier: Tier) {
    try {
      const res = (await this.client.messages.parse({
        model: this.model(tier), max_tokens: 16000, system: prompt.system, messages: prompt.messages,
        output_config: { format: zodOutputFormat(schema as never) },
      } as never)) as unknown as { parsed_output: T | null; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
      if (res.stop_reason === 'refusal') throw new AIError('The model declined this analysis request.', this.id);
      if (res.parsed_output == null) return super.completeStructured(prompt, schema, tier);
      return { value: res.parsed_output, usage: this.usage(res.usage) };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof AIError) this.mapError(e);
      return super.completeStructured(prompt, schema, tier); // instruction-based JSON fallback
    }
  }
}
