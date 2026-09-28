import type { AIProvider, AIResult, AnalyzeRequest, ExtractionInput, ExtractedFacts, GenerateRequest, Tier } from '../../types';
import { AIError } from '../../../errors';
import { estimateTokens } from '../../usage';
import { extractiveSummary } from './summarize';
import { renderLocalDraft, applyLocalRevision } from './draft';
import { analyzeFeedbackLocal } from './feedback';
import { extractFactsLocal } from './extract';
import { localAssistantReply } from './assistant';

export const LOCAL_MODEL = 'local-rules-v1';
export const wrap = <T>(value: T, inputText: string, outputText: string): AIResult<T> => ({
  value, provider: 'local', model: LOCAL_MODEL,
  usage: { inputTokens: estimateTokens(inputText), outputTokens: estimateTokens(outputText), estimated: true },
});

export class LocalProvider implements AIProvider {
  readonly id = 'local';
  model(_tier: Tier) { return LOCAL_MODEL; }
  async generateText(req: GenerateRequest): Promise<AIResult<string>> {
    switch (req.task.kind) {
      case 'chapter_draft': { const out = renderLocalDraft(req.task.pack); return wrap(out, req.system + req.messages.map((m) => m.content).join(''), out); }
      case 'chapter_revision': { const r = applyLocalRevision(req.task.baseText, req.task.items); return wrap(r.text, req.task.baseText, r.text); }
      case 'assistant': { const out = localAssistantReply(req.task); return wrap(out, req.task.message, out); }
      default: throw new AIError(`Local provider does not support generation task "${(req.task as { kind: string }).kind}"`, 'local');
    }
  }
  async analyzeText<T>(req: AnalyzeRequest<T>): Promise<AIResult<T>> {
    switch (req.task.kind) {
      // Rule-based continuity + critic checks run for every provider (pipeline/checks.ts); the local LLM-review step adds nothing.
      case 'continuity_review': case 'critic_review': return wrap({ issues: [] } as T, '', '');
      case 'feedback_analysis': { const out = analyzeFeedbackLocal(req.task.input); return wrap(out as T, JSON.stringify(req.task.input), JSON.stringify(out)); }
      default: throw new AIError(`Local provider does not support analysis task "${(req.task as { kind: string }).kind}"`, 'local');
    }
  }
  async summarize(text: string, opts: { maxWords?: number } = {}): Promise<AIResult<string>> {
    const out = extractiveSummary(text, opts.maxWords ?? 120);
    return wrap(out, text, out);
  }
  async extractMemory(input: ExtractionInput): Promise<AIResult<ExtractedFacts>> {
    const out = extractFactsLocal(input);
    return wrap(out, input.text, JSON.stringify(out));
  }
}
