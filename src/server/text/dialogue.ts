import { buildNameRegex, normalizeApostrophes, splitParagraphs } from './tokenize';

export const SPEECH_VERBS = ('said|says|asked|asks|replied|replies|whispered|shouted|muttered|snapped|murmured|called|answered|added|' +
  'growled|laughed|sighed|hissed|yelled|cried|demanded|insisted|admitted|continued|began|told|warned|breathed|drawled|teased|' +
  'lied|offered|repeated|agreed|protested|pleaded|countered|grumbled|announced|declared|stammered|croaked|barked|mused');
export type CastMember = { id: string; names: string[] };
export type AttributedLine = { text: string; paragraphIndex: number; speakerId: string | null; addresseeId: string | null };

export function findQuotes(p: string): { text: string; index: number; end: number }[] {
  const out: { text: string; index: number; end: number }[] = [];
  for (const m of p.matchAll(/“([^”]+)”|"([^"]+)"/g)) out.push({ text: (m[1] ?? m[2]).trim(), index: m.index!, end: m.index! + m[0].length });
  return out;
}

export function attributeDialogue(text: string, cast: CastMember[]): AttributedLine[] {
  const nameToId = new Map<string, string>();
  for (const c of cast) for (const n of c.names) nameToId.set(normalizeApostrophes(n), c.id);
  const idOf = (matched: string) => nameToId.get(normalizeApostrophes(matched));
  const nameRe = buildNameRegex([...nameToId.keys()]);
  const N = nameRe ? nameRe.source : '(?!)';
  const after = new RegExp(`^[\\s,.!?—–-]*(?:(?:${SPEECH_VERBS})\\s+${N}|${N}\\s+(?:${SPEECH_VERBS}))`, 'u');
  const before = new RegExp(`${N}\\s+(?:${SPEECH_VERBS})[^“"]{0,30}[:,]?\\s*$`, 'u');
  const all = (s: string) => (nameRe ? [...s.matchAll(new RegExp(nameRe.source, 'gu'))].map((m) => idOf(m[1])!).filter(Boolean) : []);
  const out: AttributedLine[] = [];
  splitParagraphs(text).forEach((para, paragraphIndex) => {
    const quotes = findQuotes(para);
    if (!quotes.length) return;
    let outside = para;
    for (const q of [...quotes].reverse()) outside = outside.slice(0, q.index) + ' ' + outside.slice(q.end);
    const actorsHere = new Set(all(outside));
    quotes.forEach((q, qi) => {
      const tail = para.slice(q.end, q.end + 80);
      const head = para.slice(qi === 0 ? 0 : quotes[qi - 1].end, q.index);
      const m = tail.match(after) ?? head.match(before);
      let speakerId: string | null = null;
      if (m) { const nm = m.slice(1).find(Boolean); speakerId = nm ? idOf(nm) ?? null : null; }
      else if (actorsHere.size === 1) speakerId = [...actorsHere][0];
      let addresseeId = all(q.text).find((id) => id !== speakerId) ?? null;
      if (!addresseeId && speakerId && actorsHere.size === 2) addresseeId = [...actorsHere].find((x) => x !== speakerId) ?? null;
      out.push({ text: q.text, paragraphIndex, speakerId, addresseeId });
    });
  });
  return out;
}
