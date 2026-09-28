import { LLMProviderBase, type Completion } from './llm-base';
import type { AIResult, EmbeddingProvider, Prompt, Tier } from '../types';
import { AIError } from '../../errors';
import { estimateTokens } from '../usage';

type F = typeof fetch;
export class OllamaProvider extends LLMProviderBase {
  readonly id = 'ollama';
  private f: F; private baseUrl: string;
  constructor(opts: { baseUrl: string; main: string; fast: string; fetch?: F }) {
    super({ main: opts.main, fast: opts.fast }); this.f = opts.fetch ?? fetch; this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }
  protected async complete(prompt: Prompt, opts: { tier: Tier; json: boolean; maxTokens: number; model?: string }): Promise<Completion> {
    const res = await this.f(`${this.baseUrl}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model ?? this.model(opts.tier), stream: false, ...(opts.json ? { format: 'json' } : {}),
        messages: [{ role: 'system', content: prompt.system }, ...prompt.messages], options: { num_predict: opts.maxTokens },
      }),
    });
    if (!res.ok) throw new AIError(`Ollama error ${res.status}`, this.id);
    const j = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    const text = j.message?.content ?? '';
    const promptText = prompt.system + prompt.messages.map((m) => m.content).join('');
    return {
      text,
      usage: { inputTokens: j.prompt_eval_count ?? estimateTokens(promptText), outputTokens: j.eval_count ?? estimateTokens(text), estimated: j.prompt_eval_count === undefined },
    };
  }
}
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama';
  readonly model: string; private f: F; private baseUrl: string;
  constructor(opts: { baseUrl: string; model: string; fetch?: F }) { this.model = opts.model; this.f = opts.fetch ?? fetch; this.baseUrl = opts.baseUrl.replace(/\/$/, ''); }
  async embed(texts: string[]): Promise<AIResult<number[][]>> {
    try {
      const res = await this.f(`${this.baseUrl}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: this.model, input: texts }) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const j = (await res.json()) as { embeddings: number[][] };
      return { value: j.embeddings, provider: this.id, model: this.model, usage: { inputTokens: texts.reduce((a, t) => a + estimateTokens(t), 0), outputTokens: 0, estimated: true } };
    } catch (e) { throw new AIError(`Ollama embeddings failed: ${e instanceof Error ? e.message : String(e)}`, this.id); }
  }
}
