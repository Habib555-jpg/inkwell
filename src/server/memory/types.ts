import type { ChapterRequirements } from '../services/chapters';
export type DialogueBalance = 'dialogue_heavy' | 'balanced' | 'narration_heavy';

export interface VoiceCard {
  register: string; sentenceLength: string; emotionalBaseline: string;
  verbalTics: string[]; avoid: string[];
  sampleLines: { quote: string; chapterNumber: number }[];
  relationshipRegisters: { toName: string; note: string }[];
  userVoiceNotes: string; forming: boolean; lineCount: number;
  /** Canon dialogue averages, when derived (used by the critic's voice-drift check). */
  formality?: number; avgWordsPerLine?: number;
}
export interface CharacterCard {
  id: string; name: string; aliases: string[]; role: string; personality: string; goals: string; fears: string;
  motivations: string; abilities: string; weaknesses: string; speechStyle: string; vocabulary: string;
  developmentNotes: string; currentStatus: string; currentLocation: string | null;
  voice: VoiceCard; recentEvents: string[];
}
export interface RetrievedChunk { chunkId: string; chapterNumber: number; content: string; score: number }
export interface ContextPack {
  novel: { id: string; title: string; genre: string; premise: string; setting: string; writingStyle: string; tone: string;
    rulesText: string; pov: string; tense: string; dialogueBalance: DialogueBalance; targetWords: number };
  chapter: { id: string; number: number; title: string } & ChapterRequirements;
  characters: CharacterCard[];
  relationships: { fromName: string; toName: string; type: string; description: string; isSecret: boolean }[];
  timeline: { chapterNumber: number; description: string }[];
  recentChapters: { number: number; title: string; summary: string; tail: string | null }[];
  retrieved: RetrievedChunk[];
  world: { kind: 'location' | 'faction' | 'world_rule' | 'story_object'; name: string; description: string; category?: string }[];
  preferences: { scope: 'global' | 'story' | 'character'; statement: string; characterName?: string }[];
  budget: { limit: number; used: number; trimmed: string[] };
  included: { section: string; id: string }[];
}
