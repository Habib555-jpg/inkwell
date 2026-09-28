import type { z } from 'zod';
import type { ContextPack } from '../memory/types';

export type Tier = 'main' | 'fast';
export interface TokenUsage { inputTokens: number; outputTokens: number; estimated: boolean }
export interface AIResult<T> { value: T; usage: TokenUsage; provider: string; model: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface Prompt { system: string; messages: ChatMessage[] }

export type FeedbackScope = 'chapter' | 'character' | 'story' | 'global';
export type RevisionAction =
  | 'remove' | 'add' | 'rewrite' | 'dialogue_casual' | 'dialogue_formal'
  | 'shorten_description' | 'expand_description' | 'more_internal_monologue' | 'fix_continuity' | 'other';
export interface RevisionItem {
  id: string; change: string; rationale: string; action: RevisionAction;
  target?: string; characterId?: string; scope: FeedbackScope; status: 'pending' | 'accepted' | 'rejected';
}
export type AssistantMode = 'generate' | 'revise' | 'continuity' | 'brainstorm' | 'character' | 'story_memory' | 'critic';

export interface FeedbackAnswers {
  whatWorked: string; whatDidnt: string; changesRequested: string; charactersOk: string;
  dialogueNatural: string; followedInstructions: string; remove: string; add: string;
}
export interface FeedbackAnalysisInput {
  answers: FeedbackAnswers; rating: number; chapterNumber: number;
  characters: { id: string; name: string; aliases: string[] }[];
}
export interface FeedbackTheme { themeKey: string; scope: FeedbackScope; characterId?: string; statement: string }
export interface FeedbackAnalysis { items: RevisionItem[]; themes: FeedbackTheme[]; summary: string }

export interface Issue {
  severity: 'info' | 'warning' | 'error';
  category: string; // closed lists in pipeline/continuity.ts (CONTINUITY_CATEGORIES) and pipeline/critic.ts (CRITIC_CATEGORIES)
  message: string;
  evidence?: { chapterNumber?: number; quote?: string; draftQuote?: string };
  characterId?: string;
}

export type GenerationTask =
  | { kind: 'chapter_draft'; pack: ContextPack }
  | { kind: 'chapter_revision'; pack: ContextPack; baseText: string; items: RevisionItem[] }
  | { kind: 'assistant'; mode: AssistantMode; pack: ContextPack | null; message: string; draft: string | null; extra?: Record<string, unknown> };
/** `model` overrides the tier's model (per-novel setting `novel_settings.ai_model`). */
export interface GenerateRequest extends Prompt { task: GenerationTask; tier?: Tier; maxTokens?: number; model?: string }

export type AnalysisTask =
  | { kind: 'feedback_analysis'; input: FeedbackAnalysisInput }
  | { kind: 'continuity_review'; draft: string; pack: ContextPack }
  | { kind: 'critic_review'; draft: string; pack: ContextPack };
export interface AnalyzeRequest<T> extends Prompt { schema: z.ZodType<T>; task: AnalysisTask; tier?: Tier }

export interface KnownEntities {
  characters: { id: string; name: string; aliases: string[] }[];
  locations: { id: string; name: string }[];
  factions: { id: string; name: string }[];
  worldRules: { id: string; name: string; description: string }[];
  objects: { id: string; name: string }[];
}
export interface ExtractionInput { text: string; chapterNumber: number; known: KnownEntities }
export type WorldRuleCategory = 'magic' | 'technology' | 'history' | 'rule' | 'term' | 'other';
export interface ExtractedEntity { name: string; description?: string }
export interface ExtractedFacts {
  characters: { name: string; description?: string; status?: string; locationName?: string; evidence?: string }[];
  locations: ExtractedEntity[];
  factions: ExtractedEntity[];
  objects: ExtractedEntity[];
  worldRules: { name: string; category: WorldRuleCategory; description: string }[];
  events: { description: string; characterNames: string[]; locationName?: string; importance: 1 | 2 | 3 }[];
  relationships: { from: string; to: string; type: string; description?: string; isSecret?: boolean; evidence?: string }[];
  revelations: string[];
}

export interface AIProvider {
  readonly id: string;
  model(tier: Tier): string;
  generateText(req: GenerateRequest): Promise<AIResult<string>>;
  analyzeText<T>(req: AnalyzeRequest<T>): Promise<AIResult<T>>;
  summarize(text: string, opts?: { maxWords?: number }): Promise<AIResult<string>>;
  extractMemory(input: ExtractionInput): Promise<AIResult<ExtractedFacts>>;
}
export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  embed(texts: string[]): Promise<AIResult<number[][]>>;
}
