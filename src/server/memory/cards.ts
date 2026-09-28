import type * as s from '../db/schema';
import type { CharacterCard, VoiceCard } from './types';
type CharRow = typeof s.characters.$inferSelect;
type VoiceRow = typeof s.characterVoiceProfiles.$inferSelect;

export const emptyVoice = (c: CharRow): VoiceCard => ({
  register: '', sentenceLength: '', emotionalBaseline: '', verbalTics: [], avoid: [], sampleLines: [], relationshipRegisters: [],
  userVoiceNotes: [c.speechStyle, c.vocabulary].filter(Boolean).join(' · '), forming: true, lineCount: 0,
});
/** `beforeChapter`: only canon lines from earlier chapters are offered as samples (no lines from the future). */
export function voiceCard(c: CharRow, p: VoiceRow | null, nameById: Map<string, string>, beforeChapter = Infinity): VoiceCard {
  if (!p) return emptyVoice(c);
  const early = (x: { chapterNumber: number }) => x.chapterNumber < beforeChapter;
  const samples = [...p.pinnedSamples.filter(early), ...p.sampleLines.filter((x) => early(x) && !p.pinnedSamples.some((y) => y.quote === x.quote))].slice(0, 5);
  return {
    register: p.register, sentenceLength: p.sentenceLength, emotionalBaseline: p.emotionalBaseline,
    verbalTics: p.verbalTics, avoid: p.avoid, sampleLines: samples,
    relationshipRegisters: p.relationshipRegisters.map((r) => ({ toName: nameById.get(r.toCharacterId) ?? 'someone', note: r.note })),
    userVoiceNotes: [p.userVoiceNotes, c.speechStyle, c.vocabulary].filter(Boolean).join(' · '),
    forming: p.lineCount < 5, lineCount: p.lineCount,
    formality: p.stats.formality, avgWordsPerLine: p.stats.avgWordsPerLine,
  };
}
export function characterCard(c: CharRow, p: VoiceRow | null, locationName: string | null, recentEvents: string[], nameById: Map<string, string>, beforeChapter = Infinity): CharacterCard {
  return {
    id: c.id, name: c.name, aliases: c.aliases, role: c.role, personality: c.personality, goals: c.goals, fears: c.fears,
    motivations: c.motivations, abilities: c.abilities, weaknesses: c.weaknesses, speechStyle: c.speechStyle, vocabulary: c.vocabulary,
    developmentNotes: c.developmentNotes, currentStatus: c.currentStatus, currentLocation: locationName,
    voice: voiceCard(c, p, nameById, beforeChapter), recentEvents,
  };
}
