import { words, stem } from './tokenize';
export type Emotion = 'joy' | 'anger' | 'fear' | 'sadness' | 'calm';
const LEX: Record<Emotion, string[]> = {
  joy: ['laugh', 'smil', 'grin', 'delight', 'happy', 'joy', 'cheer', 'glad', 'giddy', 'beam', 'thrill', 'elat'],
  anger: ['angry', 'rage', 'furious', 'snarl', 'glare', 'seeth', 'hate', 'fury', 'slam', 'livid', 'resent', 'bitter', 'betray'],
  fear: ['afraid', 'fear', 'terror', 'trembl', 'panic', 'dread', 'shiver', 'frighten', 'scare', 'flinch', 'horror'],
  sadness: ['grief', 'griev', 'mourn', 'tear', 'weep', 'cry', 'cri', 'sob', 'sorrow', 'loss', 'lose', 'ache', 'hollow', 'numb', 'funeral', 'despair', 'death', 'dead', 'die', 'slay', 'murder', 'kill'],
  calm: ['calm', 'steady', 'quiet', 'peace', 'serene', 'relax', 'compos'],
};
export const NEGATIVE_EMOTIONS: ReadonlySet<Emotion> = new Set(['anger', 'fear', 'sadness']);
export function emotionCounts(text: string): Record<Emotion, number> {
  const c: Record<Emotion, number> = { joy: 0, anger: 0, fear: 0, sadness: 0, calm: 0 };
  for (const w of words(text)) {
    const s = stem(w);
    for (const e of Object.keys(LEX) as Emotion[]) if (LEX[e].some((root) => s.startsWith(root))) { c[e]++; break; }
  }
  return c;
}
export function dominantEmotion(text: string, minHits = 2): Emotion | null {
  const [e, n] = (Object.entries(emotionCounts(text)) as [Emotion, number][]).sort((a, b) => b[1] - a[1])[0];
  return n >= minHits ? e : null;
}
