import type { ContextPack, VoiceCard } from '../../../memory/types';
import { applyContractions, expandContractions } from '../../../text/style';
import { buildNameRegex, escapeRe, tokenOverlap } from '../../../text/tokenize';
import type { RevisionItem } from '../../types';
import { findQuotes } from '../../../text/dialogue';
import { splitParagraphs as paras } from '../../../text/tokenize';

export const LOCAL_DRAFT_LABEL = '[Local draft — connect an AI provider for full prose]';

export function shapeLine(text: string, v: VoiceCard, first: boolean): string {
  let t = text.trim();
  if (v.register === 'formal') t = expandContractions(t);
  else if (v.register === 'casual' || v.register === 'crude') t = applyContractions(t);
  for (const w of v.avoid) t = t.replace(new RegExp(`\\s*\\b${escapeRe(w)}\\b`, 'gi'), '');
  const tic = v.verbalTics.find((x) => x.split(/\s+/).length <= 2);
  if (first && tic && !t.toLowerCase().startsWith(tic.toLowerCase())) t = `${tic[0].toUpperCase()}${tic.slice(1)}, ${t}`;
  return t.replace(/\s{2,}/g, ' ');
}

export function renderLocalDraft(pack: ContextPack): string {
  const c = pack.chapter;
  const cast = pack.characters;
  const speakerFor = (point: string, i: number) => {
    for (const ch of cast) { const re = buildNameRegex([ch.name, ...ch.aliases]); if (re && new RegExp(re.source, 'u').test(point)) return ch; }
    return cast.length ? cast[i % cast.length] : null;
  };
  const events = c.requiredEvents.length ? c.requiredEvents : [c.mainIdea || 'The chapter unfolds'];
  const firstLineSpoken = new Set<string>();
  const scenes = events.map((ev, si) => {
    const where = cast.find((x) => x.currentLocation)?.currentLocation;
    const present = cast.map((x) => x.name).join(', ');
    const canon = [...pack.retrieved].sort((a, b) => tokenOverlap(ev, b.content) - tokenOverlap(ev, a.content))[0];
    const beats = c.dialoguePoints.filter((_, di) => di % events.length === si).map((point, di) => {
      const sp = speakerFor(point, si + di);
      if (!sp) return `(Dialogue beat) ${point}`;
      const quoted = point.match(/[“"]([^”"]+)[”"]/);
      if (quoted) {
        const line = shapeLine(quoted[1], sp.voice, !firstLineSpoken.has(sp.id)); firstLineSpoken.add(sp.id);
        return `“${line},” ${sp.name.split(' ')[0]} said.`;
      }
      const v = sp.voice;
      const cue = [v.register && `${v.register} register`, v.sentenceLength && `${v.sentenceLength} lines`, v.sampleLines[0] && `e.g. “${v.sampleLines[0].quote}”`].filter(Boolean).join('; ');
      return `${sp.name}${cue ? ` (${cue})` : ''} — ${point}`;
    });
    return [
      `Scene ${si + 1} — ${ev}`,
      [where && `Setting: ${where}.`, present && `Present: ${present}.`].filter(Boolean).join(' '),
      `${ev}.`,
      canon && tokenOverlap(ev, canon.content) > 0 ? `(Canon reminder, chapter ${canon.chapterNumber}: ${canon.content.split(/(?<=[.!?])\s/)[0]})` : '',
      ...beats,
    ].filter(Boolean).join('\n\n');
  });
  const prev = pack.recentChapters[0];
  return [
    LOCAL_DRAFT_LABEL,
    `Chapter ${c.number}: ${c.title || c.mainIdea || 'Untitled'}`,
    prev?.summary ? `Previously: ${prev.summary}` : '',
    c.mainIdea ? `Chapter focus: ${c.mainIdea}` : '',
    ...scenes,
  ].filter(Boolean).join('\n\n');
}
export const LOCAL_REVISION_ACTIONS = new Set(['remove', 'add', 'dialogue_casual', 'dialogue_formal', 'shorten_description']);

const mapQuotes = (p: string, fn: (q: string) => string) => {
  let out = p;
  for (const q of findQuotes(p).reverse()) out = out.slice(0, q.index + 1) + fn(out.slice(q.index + 1, q.end - 1)) + out.slice(q.end - 1);
  return out;
};
export function applyLocalRevision(text: string, items: RevisionItem[]) {
  let ps = paras(text); const applied: string[] = []; const notApplied: string[] = [];
  for (const it of items) {
    const target = it.target ?? it.change;
    switch (it.action) {
      case 'remove': { const before = ps.length; ps = ps.filter((p) => tokenOverlap(target, p) < 0.5); (ps.length < before ? applied : notApplied).push(it.id); break; }
      case 'add': ps.push(`${target.replace(/^Add:\s*/i, '')}.`.replace(/\.\.$/, '.')); applied.push(it.id); break;
      case 'dialogue_casual': ps = ps.map((p) => mapQuotes(p, applyContractions)); applied.push(it.id); break;
      case 'dialogue_formal': ps = ps.map((p) => mapQuotes(p, expandContractions)); applied.push(it.id); break;
      case 'shorten_description': ps = ps.map((p) => (findQuotes(p).length ? p : p.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '))); applied.push(it.id); break;
      default: notApplied.push(it.id);
    }
  }
  return { text: ps.join('\n\n'), applied, notApplied };
}
