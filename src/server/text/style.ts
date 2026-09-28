import { words } from './tokenize';
import { findQuotes } from './dialogue';

export interface LineStats { lines: number; avgWordsPerLine: number; contractionRate: number; questionRate: number; exclamationRate: number; formality: number; abstractRate: number }
const CONTRACTION = /[\p{L}]+['’](?:t|s|re|ve|ll|d|m)(?![\p{L}])/giu;
const INFORMAL = new Set(['yeah', 'gonna', 'wanna', 'kinda', 'hey', 'ugh', 'damn', 'nah', 'yep', 'okay', 'ok', 'huh', 'sorta', 'gotta', 'dunno', 'crap', 'hell', 'whatever']);
const FORMAL = new Set(['indeed', 'perhaps', 'therefore', 'shall', 'must', 'sir', 'madam', 'certainly', 'nevertheless', 'furthermore', 'however', 'whom', 'regarding', 'ought', 'thus', 'hence', 'wise', 'proceed', 'caution', 'correct']);
const FORMAL_PHRASES = /\b(?:do not|cannot|will not|i am|it is|you are|we are|does not|did not|is not|are not)\b/gi;
export const ABSTRACT_WORDS = new Set(['destiny', 'truth', 'existence', 'meaning', 'eternity', 'fate', 'soul', 'essence', 'purpose', 'infinite', 'universe', 'eternal', 'mortality', 'transcend']);
const PROFANITY = new Set(['damn', 'hell', 'shit', 'fuck', 'bastard', 'bloody', 'crap']);

export function lineStats(lines: string[]): LineStats {
  const n = lines.length || 1;
  let wordsTotal = 0, contr = 0, q = 0, ex = 0, formal = 0, informal = 0, abstract = 0;
  for (const l of lines) {
    const ws = words(l); wordsTotal += ws.length;
    const c = (l.match(CONTRACTION) ?? []).length; if (c > 0) contr++; informal += c;
    if (/\?["”]?\s*$/.test(l)) q++; if (/!["”]?\s*$/.test(l)) ex++;
    formal += (l.match(FORMAL_PHRASES) ?? []).length;
    for (const w of ws) {
      const lw = w.toLowerCase();
      if (FORMAL.has(lw)) formal++;
      if (INFORMAL.has(lw)) informal++;
      if (ABSTRACT_WORDS.has(lw)) abstract++;
      if (lw.length >= 10) formal += 0.5;
    }
    if (ws.length > 0 && ws.length < 4) informal += 0.5;
  }
  return {
    lines: lines.length, avgWordsPerLine: wordsTotal / n, contractionRate: contr / n, questionRate: q / n,
    exclamationRate: ex / n, formality: (formal + 1) / (formal + informal + 2), abstractRate: abstract / Math.max(1, wordsTotal),
  };
}
export const statVector = (s: LineStats) => [Math.min(s.avgWordsPerLine / 30, 1), s.contractionRate, s.questionRate, s.exclamationRate, s.formality];
export function registerFor(s: LineStats, lines: string[] = []): 'crude' | 'casual' | 'neutral' | 'formal' {
  const prof = lines.flatMap((l) => words(l)).filter((w) => PROFANITY.has(w.toLowerCase())).length / Math.max(1, lines.length);
  if (prof >= 0.3) return 'crude';
  return s.formality >= 0.65 ? 'formal' : s.formality <= 0.35 ? 'casual' : 'neutral';
}
export const sentenceLengthFor = (avg: number) => (avg < 7 ? 'short' : avg > 16 ? 'long' : 'medium');

const PAIRS: [RegExp, string, RegExp, string][] = [
  [/\b([Dd])o not\b/g, "$1on't", /\b([Dd])on['’]t\b/g, '$1o not'],
  [/\b([Cc])annot\b/g, "$1an't", /\b([Cc])an['’]t\b/g, '$1annot'],
  [/\b([Ww])ill not\b/g, "$1on't", /\b([Ww])on['’]t\b/g, '$1ill not'],
  [/\b([Dd])id not\b/g, "$1idn't", /\b([Dd])idn['’]t\b/g, '$1id not'],
  [/\b([Ii])s not\b/g, "$1sn't", /\b([Ii])sn['’]t\b/g, '$1s not'],
  [/\b([Ii])t is\b/g, "$1t's", /\b([Ii])t['’]s\b/g, '$1t is'],
  [/\b([Tt])hat is\b/g, "$1hat's", /\b([Tt])hat['’]s\b/g, '$1hat is'],
  [/\bI am\b/g, "I'm", /\bI['’]m\b/g, 'I am'],
  [/\b([Yy])ou are\b/g, "$1ou're", /\b([Yy])ou['’]re\b/g, '$1ou are'],
  [/\b([Ww])e are\b/g, "$1e're", /\b([Ww])e['’]re\b/g, '$1e are'],
];
export const applyContractions = (t: string) => PAIRS.reduce((s, [re, rep]) => s.replace(re, rep), t);
export const expandContractions = (t: string) => PAIRS.reduce((s, [, , re, rep]) => s.replace(re, rep), t);

export function dialogueRatio(text: string): number {
  const total = words(text).length;
  if (!total) return 0;
  return findQuotes(text).reduce((a, q) => a + words(q.text).length, 0) / total;
}
