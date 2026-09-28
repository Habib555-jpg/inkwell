export const STOPWORDS = new Set((
  'a about above after again against all am an and any are as at be because been before being below between both but by ' +
  'can could did do does doing down during each few for from further had has have having he her here hers herself him himself ' +
  'his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours out ' +
  'over own same she should so some such than that the their theirs them themselves then there these they this those through ' +
  'to too under until up very was we were what when where which while who whom why will with would you your yours yourself ' +
  'said says say asked one two also back still even could like onto upon must shall may might'
).split(' '));

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
export const words = (t: string): string[] => t.match(WORD_RE) ?? [];

/** Common irregular narrative verbs → base form, so "Mira stole" matches the requirement "Mira steals". */
const IRREGULAR: Record<string, string> = Object.fromEntries(('died:die dying:die stole:steal stolen:steal took:take taken:take fought:fight fell:fall ' +
  'fallen:fall ran:run found:find met:meet left:leave went:go gone:go saw:see seen:see knew:know known:know told:tell gave:give given:give ' +
  'brought:bring thought:think caught:catch hid:hide hidden:hide spoke:speak spoken:speak broke:break broken:break woke:wake rose:rise ' +
  'swore:swear sworn:swear bought:buy sold:sell led:lead won:win lost:lose held:hold kept:keep began:begin begun:begin felt:feel fled:flee ' +
  'stood:stand sat:sit wore:wear drew:draw drawn:draw threw:throw thrown:throw struck:strike slew:slay slain:slay killed:kill wept:weep ' +
  'betrayed:betray became:become came:come made:make said:say heard:hear'
).split(' ').map((p) => p.split(':')));

export function stem(w: string): string {
  let s = w.toLowerCase().replace(/['’]s$/u, '');
  if (IRREGULAR[s]) return IRREGULAR[s];
  if (s.length > 4 && s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.length > 5 && s.endsWith('ing')) return s.slice(0, -3);
  if (s.length > 4 && s.endsWith('ed')) return s.slice(0, -2);
  if (s.length > 4 && /(?:ss|x|ch|sh)es$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s;
}
export const contentTokens = (t: string): string[] =>
  words(t).map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem);

export function tokenOverlap(query: string, text: string): number {
  const q = new Set(contentTokens(query));
  if (!q.size) return 0;
  const t = new Set(contentTokens(text));
  let hit = 0; for (const x of q) if (t.has(x)) hit++;
  return hit / q.size;
}

export function splitParagraphs(t: string): string[] {
  const parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : t.split(/\n/).map((p) => p.trim()).filter(Boolean);
}
export function splitSentences(t: string): string[] {
  return t.replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[\p{Lu}\p{N}])/u)
    .map((s) => s.trim()).filter(Boolean);
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NOT_NAMES = new Set(('I The A An He She They It We You His Her Their Its Our My Your But And Or So Then When What Why How Who ' +
  'Where Yes No Oh Ah This That These Those There Here If As At In On Of For With To From By Not Now Well Still Even Just ' +
  'Mr Mrs Ms Lord Lady Sir Madam Chapter Scene God Gods Everyone Someone Nobody Nothing Something Local').split(' '));
const CONNECTORS = new Set(['of', 'the', 'de', 'du', 'von', 'van']);

/**
 * Capitalized sequences (1–4 words, connectors like "of the" allowed inside).
 * Returns only candidates seen at least once away from a sentence start (so "Night fell." is not a name).
 * Single words that also appear lowercase elsewhere in the text are rejected.
 */
export function properNouns(text: string): Map<string, { count: number; nonInitial: number }> {
  const out = new Map<string, { count: number; nonInitial: number }>();
  const lowerSeen = new Set(words(text).filter((w) => w === w.toLowerCase()));
  for (const sentence of splitSentences(text)) {
    const toks = [...sentence.matchAll(/[\p{L}][\p{L}'’-]*/gu)].map((m) => ({ w: m[0], i: m.index! }));
    for (let i = 0; i < toks.length; i++) {
      const first = toks[i].w;
      if (!/^\p{Lu}/u.test(first) || NOT_NAMES.has(first.replace(/['’]s$/u, ''))) continue;
      const parts = [first]; let j = i + 1;
      while (j < toks.length && parts.length < 4) {
        const n = toks[j].w;
        if (/^\p{Lu}/u.test(n) && !NOT_NAMES.has(n)) { parts.push(n); j++; continue; }
        if (CONNECTORS.has(n) && j + 1 < toks.length && /^\p{Lu}/u.test(toks[j + 1].w)) { parts.push(n, toks[j + 1].w); j += 2; continue; }
        break;
      }
      let name = parts.join(' ');
      if (parts.length === 1) name = name.replace(/['’]s$/u, ''); // "Mira's" → "Mira"; keep "Gull's Rest"
      if (parts.length === 1 && lowerSeen.has(name.toLowerCase())) { i = j - 1; continue; }
      const e = out.get(name) ?? { count: 0, nonInitial: 0 };
      e.count++;
      const before = sentence.slice(0, toks[i].i).replace(/["“‘(\s]/gu, '');
      if (before.length > 0) e.nonInitial++;
      out.set(name, e);
      i = j - 1;
    }
  }
  for (const [k, v] of out) if (v.nonInitial === 0) out.delete(k);
  return out;
}

/**
 * Regex matching any of the names with unicode-aware boundaries; longest first; capture group 1 = the matched text.
 * Straight and curly apostrophes are interchangeable ("Gull's Rest" matches "Gull’s Rest").
 * Callers map matches back to names with normalizeApostrophes().
 */
/** Regex alternation source for the names (longest first, apostrophe-tolerant), or null when empty. */
export function nameAlternation(names: string[]): string | null {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  return uniq.length ? uniq.map((n) => escapeRe(n).replace(/['’]/g, "['’]")).join('|') : null;
}
export function buildNameRegex(names: string[]): RegExp | null {
  const alt = nameAlternation(names);
  return alt ? new RegExp(`(?<![\\p{L}])(${alt})(?![\\p{L}])`, 'gu') : null;
}
export const normalizeApostrophes = (s: string) => s.replace(/’/g, "'");
