import type { ContextPack, VoiceCard } from '../../../memory/types';
import { applyContractions, expandContractions } from '../../../text/style';
import { buildNameRegex, escapeRe, tokenOverlap } from '../../../text/tokenize';

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
