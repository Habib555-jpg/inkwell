import { contentTokens, properNouns, splitSentences, words } from '../../../text/tokenize';

export function extractiveSummary(text: string, maxWords = 120): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return '';
  const tf = new Map<string, number>();
  contentTokens(text).forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
  const names = [...properNouns(text).keys()];
  const scored = sentences.map((s, i) => {
    const toks = contentTokens(s);
    const base = toks.reduce((a, t) => a + (tf.get(t) ?? 0), 0) / Math.sqrt(Math.max(1, toks.length));
    return { s, i, score: base + 2 * names.filter((n) => s.includes(n)).length + (i === 0 ? 0.5 : 0) };
  }).sort((a, b) => b.score - a.score);
  const chosen: typeof scored = []; let used = 0;
  for (const c of scored) {
    const n = words(c.s).length;
    if (used + n > maxWords) continue;
    chosen.push(c); used += n;
  }
  return chosen.sort((a, b) => a.i - b.i).map((c) => c.s).join(' ');
}

export function extractKeywords(text: string, n = 12): string[] {
  const nouns = [...properNouns(text).entries()].sort((a, b) => b[1].count - a[1].count).map(([k]) => k);
  const nounWords = new Set(nouns.flatMap((x) => x.toLowerCase().split(/\s+/)));
  // Keep a word's capitalization only if it is capitalized every time (a name that happens to start sentences).
  const tf = new Map<string, { n: number; surface: string; alwaysCap: boolean }>();
  for (const w of words(text)) {
    const [t] = contentTokens(w); if (!t) continue;
    const e = tf.get(t) ?? { n: 0, surface: w, alwaysCap: true }; e.n++;
    if (!/^\p{Lu}/u.test(w)) e.alwaysCap = false;
    tf.set(t, e);
  }
  const common = [...tf.values()].sort((a, b) => b.n - a.n).map((e) => (e.alwaysCap ? e.surface : e.surface.toLowerCase()))
    .filter((w) => !nounWords.has(w.toLowerCase()));
  return [...nouns, ...common].slice(0, n);
}
