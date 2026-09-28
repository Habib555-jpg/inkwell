import { randomUUID } from 'node:crypto';
import type { FeedbackAnalysis, FeedbackAnalysisInput, FeedbackAnswers, FeedbackScope, RevisionItem } from '../../types';
import { THEMES, detectTheme } from '../../../feedback/themes';
import { buildNameRegex, splitSentences } from '../../../text/tokenize';

const LABELS: Record<keyof FeedbackAnswers, string> = {
  whatWorked: 'What worked', whatDidnt: 'What did not work', changesRequested: 'Changes requested', charactersOk: 'Character behavior',
  dialogueNatural: 'Dialogue', followedInstructions: 'Instructions', remove: 'Remove', add: 'Add',
};
const AFFIRMATIVE = /^\s*(yes|yeah|yep|fine|good|great|ok|okay|they did|it did|mostly|sure)[\s.!]*$/i;
const CHAPTER_MARKERS = /\b(this chapter|this scene|here|the scene where|the part where|the ending|the opening|at the end|at the start|in this one)\b|["“][^"”]{6,}["”]/i;
const VOICE_THEMES = new Set(['dialogue.too_formal', 'dialogue.too_casual', 'dialogue.same_voice', 'character.voice']);

export function classifyScope(statement: string, field: keyof FeedbackAnswers, themeKey: string | null, characters: FeedbackAnalysisInput['characters']): { scope: FeedbackScope; characterId?: string } {
  if (field === 'remove' || field === 'add') return { scope: 'chapter' };
  const named = characters.find((c) => { const re = buildNameRegex([c.name, ...c.aliases]); return re ? new RegExp(re.source, 'u').test(statement) : false; });
  if (named && themeKey && VOICE_THEMES.has(themeKey)) return { scope: 'character', characterId: named.id };
  if (CHAPTER_MARKERS.test(statement)) return { scope: 'chapter' };
  if (named) return { scope: 'character', characterId: named.id };
  const kind = themeKey ? THEMES[themeKey].kind : null;
  if (kind === 'content') return { scope: 'story' };
  if (kind === 'style') return { scope: 'global' };
  return { scope: 'chapter' };
}

export function analyzeFeedbackLocal(input: FeedbackAnalysisInput): FeedbackAnalysis {
  const items: RevisionItem[] = []; const themes: FeedbackAnalysis['themes'] = [];
  for (const field of Object.keys(LABELS) as (keyof FeedbackAnswers)[]) {
    if (field === 'whatWorked') continue;
    const raw = (input.answers[field] ?? '').trim();
    if (!raw || AFFIRMATIVE.test(raw)) continue;
    const statements = field === 'remove' || field === 'add' ? raw.split(/\n|;/).map((x) => x.trim()).filter(Boolean) : splitSentences(raw.replace(/\n+/g, '. '));
    for (const st of statements) {
      if (AFFIRMATIVE.test(st)) continue;
      const themeKey = field === 'remove' || field === 'add' ? null : detectTheme(st);
      const { scope, characterId } = classifyScope(st, field, themeKey, input.characters);
      const action = field === 'remove' ? 'remove' : field === 'add' ? 'add' : themeKey ? THEMES[themeKey].action : 'rewrite';
      items.push({ id: randomUUID(), change: field === 'remove' ? `Remove: ${st}` : field === 'add' ? `Add: ${st}` : st,
        rationale: `From your feedback (${LABELS[field]})`, action, target: field === 'remove' || field === 'add' ? st : undefined, characterId, scope, status: 'pending' });
      if (themeKey) themes.push({ themeKey, scope, characterId, statement: st });
    }
  }
  return { items, themes, summary: `${items.length} proposed change${items.length === 1 ? '' : 's'} from a ${input.rating}/10 rating.` };
}
