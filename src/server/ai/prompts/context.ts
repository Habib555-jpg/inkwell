import type { ContextPack, CharacterCard, DialogueBalance } from '../../memory/types';
import { fence } from './analysis';

export const WRITING_PRIORITIES = [
  'Priorities, in this order when they compete:',
  '1. Continuity — never contradict canon (previous chapters, timeline, character facts, world rules).',
  '2. Character voice — each character speaks per their voice card (diction, sentence length, formality, tics); never use words on their "never uses" list; no two characters may sound alike.',
  '3. Emotional consistency — reactions follow from each character\'s current state and recent events; shifts need an on-page cause.',
  '4. Natural dialogue — vary line length; allow interruptions, fragments, silence and subtext; characters rarely announce their feelings; nobody is eloquent or philosophical unless their voice card says so.',
  '5. Pacing — honor the dialogue balance and target length; give each required event proportionate space; cut scenes that do no work.',
].join('\n');

export const dialogueBalanceGuidance = (b: DialogueBalance) =>
  b === 'dialogue_heavy' ? 'Dialogue-heavy: roughly 45% or more of words in dialogue.'
  : b === 'narration_heavy' ? 'Narration-heavy: under about 25% of words in dialogue.'
  : 'Balanced: roughly 25–45% of words in dialogue.';

function renderCharacter(c: CharacterCard): string {
  const v = c.voice;
  const lines = [
    `## ${c.name}${c.aliases.length ? ` (aka ${c.aliases.join(', ')})` : ''}${c.role ? ` — ${c.role}` : ''}`,
    c.personality && `Personality: ${c.personality}`, c.goals && `Goals: ${c.goals}`, c.fears && `Fears: ${c.fears}`,
    c.motivations && `Motivations: ${c.motivations}`, c.abilities && `Abilities: ${c.abilities}`, c.weaknesses && `Weaknesses: ${c.weaknesses}`,
    c.currentStatus && `Current status: ${c.currentStatus}`, c.currentLocation && `Last known location: ${c.currentLocation}`,
    c.recentEvents.length ? `Recent events: ${c.recentEvents.join(' | ')}` : '',
    `Voice${v.forming ? ' (still forming — lean on the notes)' : ''}: register ${v.register || 'unknown'}, ${v.sentenceLength || 'unknown'} lines, emotional baseline ${v.emotionalBaseline || 'unknown'}.`,
    v.userVoiceNotes && `Author's voice notes: ${v.userVoiceNotes}`,
    v.verbalTics.length ? `Verbal tics: ${v.verbalTics.join(', ')}` : '',
    v.avoid.length ? `Never uses: ${v.avoid.join(', ')}` : '',
    v.relationshipRegisters.length ? `With others: ${v.relationshipRegisters.map((r) => r.note).join('; ')}` : '',
    v.sampleLines.length ? `Canon lines: ${v.sampleLines.map((s) => `“${s.quote}” (ch ${s.chapterNumber})`).join(' ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function renderContextPack(p: ContextPack): string {
  const n = p.novel;
  const parts = [
    fence('novel_profile', [`Title: ${n.title}`, `Genre: ${n.genre}`, `Premise: ${n.premise}`, `Setting: ${n.setting}`, `Style: ${n.writingStyle}`, `Tone: ${n.tone}`, `POV: ${n.pov}; tense: ${n.tense}`, n.rulesText && `Story rules: ${n.rulesText}`].filter(Boolean).join('\n')),
    p.preferences.length ? fence('writing_preferences', p.preferences.map((x) => `- (${x.scope}${x.characterName ? `: ${x.characterName}` : ''}) ${x.statement}`).join('\n')) : '',
    p.characters.length ? fence('characters', p.characters.map(renderCharacter).join('\n\n')) : '',
    p.relationships.length ? fence('relationships', p.relationships.map((r) => `- ${r.fromName} → ${r.type} → ${r.toName}${r.isSecret ? ' (secret)' : ''}${r.description ? `: ${r.description}` : ''}`).join('\n')) : '',
    p.timeline.length ? fence('timeline', p.timeline.map((e) => `- Ch ${e.chapterNumber}: ${e.description}`).join('\n')) : '',
    p.recentChapters.length ? fence('previous_chapters', p.recentChapters.map((c) => `Chapter ${c.number}${c.title ? ` "${c.title}"` : ''}: ${c.summary}${c.tail ? `\nIt ended with:\n${c.tail}` : ''}`).join('\n\n')) : '',
    p.retrieved.length ? fence('relevant_canon', p.retrieved.map((r) => `[Chapter ${r.chapterNumber}] ${r.content}`).join('\n\n')) : '',
    p.world.length ? fence('world', p.world.map((w) => `- ${w.kind.replace('_', ' ')}: ${w.name}${w.category ? ` [${w.category}]` : ''} — ${w.description}`).join('\n')) : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

export function renderRequirements(p: ContextPack): string {
  const c = p.chapter;
  const list = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join('\n');
  return fence('chapter_requirements', [
    `Chapter ${c.number}${c.title ? `: ${c.title}` : ''}`,
    c.mainIdea && `Main idea: ${c.mainIdea}`,
    c.requiredEvents.length ? `Events that MUST happen (in this order):\n${list(c.requiredEvents)}` : '',
    c.forbiddenEvents.length ? `Events that MUST NOT happen:\n${list(c.forbiddenEvents)}` : '',
    c.tone && `Tone: ${c.tone}`,
    c.dialoguePoints.length ? `Dialogue points to include:\n${list(c.dialoguePoints)}` : '',
    c.restrictions && `Restrictions: ${c.restrictions}`,
    `Target length: about ${c.targetWords ?? p.novel.targetWords} words. ${dialogueBalanceGuidance(p.novel.dialogueBalance)}`,
    c.instructions && `Additional instructions: ${c.instructions}`,
  ].filter(Boolean).join('\n'));
}
