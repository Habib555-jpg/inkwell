import type { Issue } from '../ai/types';
import type { ContextPack, RetrievedChunk } from '../memory/types';
import { buildNameRegex, properNouns, splitParagraphs, splitSentences, tokenOverlap } from '../text/tokenize';
import { attributeDialogue } from '../text/dialogue';

export const CONTINUITY_CATEGORIES = ['missing_required_event', 'forbidden_event_present', 'dead_character_acts', 'location_jump', 'canon_contradiction', 'new_entity'] as const;
export interface ContinuityInput {
  draft: string; pack: ContextPack;
  characters: { id: string; name: string; aliases: string[]; currentStatus: string; currentLocation: string | null }[];
  knownNames: string[]; locationNames: string[];
  canonSearch: (query: string) => Promise<RetrievedChunk[]>;
}
const NEGATION = /\b(?:not|never|no longer|n['’]t|almost|nearly|without)\b|n['’]t\b/i;
const DEAD = /\b(dead|deceased|died|killed|slain)\b/i;
const MEMORY_CTX = /\b(remember\w*|memor\w+|ghost|dream\w*|grave|funeral|corpse|body|once|used to|recalled?)\b/i;
const ACTION = /^(?:\s+\w+)?\s+(said|asked|walked|ran|smiled|laughed|stood|looked|turned|nodded|drew|grabbed|shouted|whispered|entered|arrived|stepped|reached|took|spoke|answered)\b/i;
const TRAVEL = /\b(travel\w*|arriv\w*|rode|ride|walk\w*|journey\w*|return\w*|reach\w*|sail\w*|flew|fly|went|came|headed|marched|fled|crossed|ferried|teleport\w*)\b/i;
const snippet = (s: string) => (s.length > 180 ? s.slice(0, 177) + '…' : s);
const nameRe = (names: string[]) => { const r = buildNameRegex(names); return r ? new RegExp(r.source, 'u') : null; };

export function checkRequiredEvents(draft: string, events: string[]): Issue[] {
  const paras = splitParagraphs(draft);
  const windows = paras.length > 1 ? paras.map((p, i) => `${p} ${paras[i + 1] ?? ''}`) : [draft];
  return events
    .filter((ev) => Math.max(0, ...windows.map((w) => tokenOverlap(ev, w))) < 0.5)
    .map((ev) => ({ severity: 'error' as const, category: 'missing_required_event', message: `Required event not found: “${ev}”` }));
}

export async function ruleContinuity(i: ContinuityInput): Promise<Issue[]> {
  const issues: Issue[] = [...checkRequiredEvents(i.draft, i.pack.chapter.requiredEvents)];
  const sentences = splitSentences(i.draft);

  for (const f of i.pack.chapter.forbiddenEvents) {
    const hit = sentences.find((s) => tokenOverlap(f, s) >= 0.6 && !NEGATION.test(s));
    if (hit) issues.push({ severity: 'error', category: 'forbidden_event_present', message: `Forbidden event appears: “${f}”`, evidence: { draftQuote: snippet(hit) } });
  }

  const cast = i.characters.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] }));
  const lines = attributeDialogue(i.draft, cast);
  const paragraphs = splitParagraphs(i.draft);
  for (const c of i.characters) {
    const re = nameRe([c.name, ...c.aliases]); if (!re) continue;
    const mentions = sentences.filter((s) => re.test(s));
    if (DEAD.test(c.currentStatus)) {
      const speaks = lines.find((l) => l.speakerId === c.id && !MEMORY_CTX.test(paragraphs[l.paragraphIndex] ?? ''));
      const acts = mentions.find((s) => { const m = s.match(re); return m && ACTION.test(s.slice(m.index! + m[0].length)) && !MEMORY_CTX.test(s); });
      if (speaks || acts)
        issues.push({ severity: 'error', category: 'dead_character_acts', characterId: c.id, message: `${c.name} is dead in canon (${c.currentStatus}) but acts in this draft.`, evidence: { draftQuote: snippet(speaks ? speaks.text : acts!) } });
    }
    if (c.currentLocation && mentions.length) {
      const locRe = nameRe(i.locationNames.filter((l) => l !== c.currentLocation));
      const first = mentions[0];
      const other = locRe ? first.match(locRe)?.[1] : undefined;
      if (other && !mentions.some((s) => TRAVEL.test(s)))
        issues.push({ severity: 'warning', category: 'location_jump', characterId: c.id, message: `${c.name} was last at ${c.currentLocation} but appears at ${other} with no travel shown.`, evidence: { draftQuote: snippet(first) } });
    }
  }

  const knownRe = nameRe(i.knownNames);
  for (const s of sentences) {
    if (!/\b(never|no longer)\b|\bnot\b|n['’]t\b/i.test(s) || !knownRe?.test(s)) continue;
    const positive = s.replace(/\b(had never|has never|never|no longer|not)\b|n['’]t\b/gi, ' ');
    for (const chunk of await i.canonSearch(positive)) {
      const match = splitSentences(chunk.content).find((cs) => !NEGATION.test(cs) && tokenOverlap(positive, cs) >= 0.6);
      if (match) {
        issues.push({ severity: 'error', category: 'canon_contradiction', message: `Draft says “${snippet(s)}”, but chapter ${chunk.chapterNumber} established: “${snippet(match)}”`, evidence: { chapterNumber: chunk.chapterNumber, quote: match, draftQuote: s } });
        break;
      }
    }
  }

  const known = new Set(i.knownNames.map((n) => n.toLowerCase().replace(/’/g, "'")));
  const fresh = [...properNouns(i.draft).keys()].filter((n) => !known.has(n.toLowerCase().replace(/’/g, "'")) && !i.knownNames.some((k) => k.toLowerCase().includes(n.toLowerCase()))).slice(0, 5);
  for (const n of fresh) issues.push({ severity: 'info', category: 'new_entity', message: `New name not in the story bible: ${n}. It will be proposed as memory only if this chapter is approved.` });
  return issues;
}
