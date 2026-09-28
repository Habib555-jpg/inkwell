import { splitParagraphs, splitSentences } from '../text/tokenize';
const wc = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Paragraph-aware chunks of ~targetWords; oversized paragraphs split by sentence; sentence-aligned overlap. */
export function chunkText(text: string, opts: { targetWords?: number; overlapWords?: number } = {}): string[] {
  const target = opts.targetWords ?? 350, overlap = opts.overlapWords ?? 50;
  const units: string[] = [];
  for (const p of splitParagraphs(text)) {
    if (wc(p) <= target * 1.5) { units.push(p); continue; }
    let buf: string[] = [];
    for (const s of splitSentences(p)) {
      if (wc(buf.join(' ')) + wc(s) > target && buf.length) { units.push(buf.join(' ')); buf = []; }
      buf.push(s);
    }
    if (buf.length) units.push(buf.join(' '));
  }
  const chunks: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (!cur.length) return;
    const chunk = cur.join('\n\n'); chunks.push(chunk);
    const tail: string[] = [];
    for (const s of splitSentences(chunk).reverse()) { if (wc([s, ...tail].join(' ')) > overlap) break; tail.unshift(s); }
    cur = tail.length ? [tail.join(' ')] : [];
  };
  for (const u of units) {
    if (wc(cur.join(' ')) + wc(u) > target && cur.some((c) => wc(c) > 0)) flush();
    cur.push(u);
  }
  if (cur.length && (chunks.length === 0 || wc(cur.join(' ')) > overlap)) chunks.push(cur.join('\n\n'));
  return chunks.length ? chunks : [text.trim()].filter(Boolean);
}
