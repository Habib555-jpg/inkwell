import type { RevisionAction } from '../ai/types';
type Theme = { pattern: RegExp; action: RevisionAction; statement: string; kind: 'style' | 'content' | 'character' };
export const THEMES: Record<string, Theme> = {
  'dialogue.too_formal': { kind: 'style', action: 'dialogue_casual', statement: 'Keep dialogue natural and informal; avoid stiff, overly formal or philosophical lines.',
    pattern: /\b(too|overly|very|so)\s+(formal|stiff|stilted|wooden|eloquent|philosophical|flowery)\b|\b(dialogue|dialog|lines|speech|talk\w*|conversations?)\b[^.]*\b(formal|stiff|stilted|wooden|eloquent|philosophical|flowery)\b/i },
  'dialogue.too_casual': { kind: 'style', action: 'dialogue_formal', statement: 'Keep dialogue register consistent with the setting; avoid modern slang.',
    pattern: /\b(too casual|too modern|slang|anachronis\w*)\b/i },
  'dialogue.same_voice': { kind: 'style', action: 'rewrite', statement: 'Give every character a clearly distinct voice.',
    pattern: /\b(sound|talk|speak)\w*\s+(the same|alike|identical)\b|\bsame voice\b/i },
  'description.too_long': { kind: 'style', action: 'shorten_description', statement: 'Keep descriptions short and purposeful.',
    pattern: /\bshorter descriptions?\b|\btoo much (description|exposition|detail)\b|\b(description|descriptions|narration|exposition)\b[^.]*\b(too long|wordy|verbose|dense|heavy|bloated)\b/i },
  'description.too_thin': { kind: 'style', action: 'expand_description', statement: 'Ground scenes with concrete sensory detail.',
    pattern: /\b(more|richer|needs?)\s+(description|detail|setting|atmosphere)\b/i },
  'monologue.more': { kind: 'style', action: 'more_internal_monologue', statement: 'Include more internal monologue.',
    pattern: /\b(more|deeper)\s+(internal monologue|inner monologue|inner thoughts|introspection|interiority)\b/i },
  'monologue.less': { kind: 'style', action: 'other', statement: 'Use internal monologue sparingly.',
    pattern: /\b(less|too much)\s+(internal monologue|inner monologue|introspection|inner thoughts)\b/i },
  'pacing.too_fast': { kind: 'style', action: 'expand_description', statement: 'Slow down key moments; let important scenes breathe.',
    pattern: /\b(rushed|too fast|too quick|hurried)\b/i },
  'pacing.too_slow': { kind: 'style', action: 'shorten_description', statement: 'Keep scenes moving; trim slow passages.',
    pattern: /\b(too slow|dragg?\w*|boring|dull|sluggish)\b/i },
  'character.voice': { kind: 'character', action: 'rewrite', statement: 'Keep this character in voice.',
    pattern: /\b(out of character|ooc|wouldn'?t (say|do|talk)|would never (say|talk|speak)|doesn'?t sound like|not (him|her|them)self)\b/i },
  'story.romance_pace': { kind: 'content', action: 'other', statement: 'Develop the romance at the author’s preferred pace.',
    pattern: /\b(romance|romantic|love (story|interest))\b[^.]*\b(slow|slower|faster|rushed|too fast)\b/i },
  'story.plot_direction': { kind: 'content', action: 'other', statement: 'Follow the author’s preferred plot direction.',
    pattern: /\b(plot|arc|subplot|reveal|twist)\b/i },
};
export function detectTheme(statement: string): string | null {
  for (const [k, t] of Object.entries(THEMES)) if (t.pattern.test(statement)) return k;
  return null;
}
