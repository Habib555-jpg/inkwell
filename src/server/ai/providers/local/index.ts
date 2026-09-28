import type { AIProvider, AIResult, AnalyzeRequest, ExtractionInput, ExtractedFacts, GenerateRequest, Tier } from '../../types';
import { AIError } from '../../../errors';
import { estimateTokens } from '../../usage';
import { extractiveSummary } from './summarize';

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
      // chapter_draft → Task 14, chapter_revision → Task 16, assistant → Task 22
      default: throw new AIError(`Local provider cannot handle ${req.task.kind} yet`, 'local');
    }
  }
  async analyzeText<T>(req: AnalyzeRequest<T>): Promise<AIResult<T>> {
    switch (req.task.kind) {
      // feedback_analysis → Task 16; continuity_review / critic_review → Task 15
      default: throw new AIError(`Local provider cannot analyze ${req.task.kind} yet`, 'local');
    }
  }
  async summarize(text: string, opts: { maxWords?: number } = {}): Promise<AIResult<string>> {
    const out = extractiveSummary(text, opts.maxWords ?? 120);
    return wrap(out, text, out);
  }
  async extractMemory(_input: ExtractionInput): Promise<AIResult<ExtractedFacts>> { throw new AIError('extraction arrives in Task 18', 'local'); }
}
