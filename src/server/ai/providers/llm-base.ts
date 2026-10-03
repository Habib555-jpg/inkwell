import { z } from 'zod';
import type { AIProvider, AIResult, AnalyzeRequest, ExtractionInput, ExtractedFacts, GenerateRequest, Prompt, Tier, TokenUsage } from '../types';
import { parseJsonLoose } from '../json';
import { buildExtractionPrompt, buildSummaryPrompt } from '../prompts/analysis';
import { extractedFactsSchema } from '../schemas';
import { AIError } from '../../errors';

export type Completion = { text: string; usage: TokenUsage };

/** An overloaded or rate-limited model (HTTP 503/429): worth trying another model, unlike a bad request. */
export function isOverload(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  if (status === 503 || status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /(503|429)|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
}
const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, estimated: a.estimated || b.estimated });

export abstract class LLMProviderBase implements AIProvider {
  abstract readonly id: string;
  /** `fallbacks`: models tried in order when the requested one is overloaded (AI_MODEL_FALLBACK). */
  constructor(protected readonly models: { main: string; fast: string; fallbacks?: string[] }) {}
  model(tier: Tier) { return tier === 'fast' ? this.models.fast : this.models.main; }
  protected abstract complete(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion>;

  protected async guarded<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (e) { if (e instanceof AIError) throw e; throw new AIError(`${this.id} request failed: ${e instanceof Error ? e.message : String(e)}`, this.id); }
  }
  protected result<T>(value: T, usage: TokenUsage, tier: Tier, model?: string): AIResult<T> { return { value, usage, provider: this.id, model: model ?? this.model(tier) }; }

  /** complete() with overload fallback: the requested model first, then each configured fallback. */
  protected call(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion & { model: string }> {
    return this.guarded(async () => {
      const first = opts.model ?? this.model(opts.tier);
      const chain = [first, ...(this.models.fallbacks ?? []).filter((m) => m !== first)];
      for (const model of chain) {
        try { return { ...(await this.complete(prompt, { ...opts, model })), model }; }
        catch (e) { if (!isOverload(e)) throw e; }
      }
      const name = this.id.charAt(0).toUpperCase() + this.id.slice(1);
      throw new AIError(`${name} is busy right now (high demand on its servers). Please try again in a minute — your work is safe.`, this.id, 'ai_busy');
    });
  }

  async generateText(req: GenerateRequest): Promise<AIResult<string>> {
    const tier = req.tier ?? 'main';
    const c = await this.call(req, { tier, json: false, maxTokens: req.maxTokens ?? 16000, model: req.model });
    return this.result(c.text.trim(), c.usage, tier, c.model);
  }

  /** JSON via instructions + zod validation with one repair round. Adapters with native structured output override this. */
  protected async completeStructured<T>(prompt: Prompt, schema: z.ZodType<T>, tier: Tier): Promise<{ value: T; usage: TokenUsage; model?: string }> {
    const p: Prompt = { system: `${prompt.system}\n\nRespond with a single JSON value matching this JSON Schema and nothing else:\n${JSON.stringify(z.toJSONSchema(schema))}`, messages: prompt.messages };
    const tryParse = (t: string) => { try { return schema.safeParse(parseJsonLoose(t)); } catch { return null; } };
    const first = await this.call(p, { tier, json: true, maxTokens: 16000 });
    let parsed = tryParse(first.text);
    let usage = first.usage;
    if (!parsed?.success) {
      const retry = await this.call({ system: p.system, messages: [...p.messages, { role: 'assistant', content: first.text }, { role: 'user', content: 'That was not valid JSON for the schema. Reply again with only the corrected JSON.' }] }, { tier, json: true, maxTokens: 16000, model: first.model });
      usage = addUsage(usage, retry.usage);
      parsed = tryParse(retry.text);
      if (!parsed?.success) throw new AIError(`${this.id} returned invalid structured output`, this.id);
    }
    return { value: parsed.data, usage, model: first.model };
  }

  async analyzeText<T>(req: AnalyzeRequest<T>): Promise<AIResult<T>> {
    const tier = req.tier ?? 'fast';
    const r = await this.completeStructured(req, req.schema, tier);
    return this.result(r.value, r.usage, tier, r.model);
  }
  async summarize(text: string, opts: { maxWords?: number } = {}): Promise<AIResult<string>> {
    const c = await this.call(buildSummaryPrompt(text, opts.maxWords ?? 150), { tier: 'fast', json: false, maxTokens: 2000 });
    return this.result(c.text.trim(), c.usage, 'fast', c.model);
  }
  async extractMemory(input: ExtractionInput): Promise<AIResult<ExtractedFacts>> {
    const r = await this.completeStructured(buildExtractionPrompt(input), extractedFactsSchema as unknown as z.ZodType<ExtractedFacts>, 'fast');
    return this.result(r.value, r.usage, 'fast', r.model);
  }
}
