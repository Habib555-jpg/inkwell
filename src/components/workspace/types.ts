import type { RevisionItem, Issue } from '@/server/ai/types';

export type ChapterStatus = 'planning' | 'drafting' | 'approved' | 'canon_changed';
export type WsChapter = {
  id: string; novelId: string; number: number; title: string; status: ChapterStatus;
  currentVersionId: string | null; approvedVersionId: string | null;
  extractionStatus: 'none' | 'pending' | 'done' | 'failed'; extractionError: string | null;
  mainIdea: string; requiredEvents: string[]; forbiddenEvents: string[]; characterIds: string[]; tone: string;
  dialoguePoints: string[]; restrictions: string; targetWords: number | null; instructions: string;
};
export type WsVersionSummary = { id: string; versionNumber: number; source: 'generated' | 'revised' | 'manual' | 'restored'; isCanon: boolean; wordCount: number; createdAt: Date; updatedAt: Date; parentVersionId: string | null };
export type ContinuityReport = { issues: Issue[]; checkedAt: string; provider: string; aiReviewed: boolean };
export type CriticReport = {
  issues: Issue[]; summary: string;
  metrics: { wordCount: number; targetWords: number; dialogueRatio: number; targetDialogueRange: [number, number]; avgSentenceLength: number; sentenceLengthStdDev: number;
    perCharacter: { characterId: string; name: string; lines: number; formality: number; avgWords: number }[] };
};
export type GenerationMeta = {
  provider?: string; model?: string; budget?: { limit: number; used: number; trimmed: string[] };
  notApplied?: { id: string; change: string }[]; included?: { section: string; id: string }[];
};
export type WsVersion = {
  id: string; versionNumber: number; source: WsVersionSummary['source']; isCanon: boolean; content: string; wordCount: number;
  generationMeta: GenerationMeta; continuityReport: ContinuityReport | null; criticReport: CriticReport | null;
};
export type WsProposal = { id: string; source: 'feedback' | 'critic'; baseVersionId: string; items: RevisionItem[] };
export type WsFeedback = { id: string; chapterVersionId: string; rating: number; createdAt: Date; whatDidnt: string; changesRequested: string };
export type MemoryLabel = { section: string; label: string; detail?: string };
