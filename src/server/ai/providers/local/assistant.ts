import type { GenerationTask } from '../../types';
import type { ContextPack } from '../../../memory/types';
import { buildNameRegex } from '../../../text/tokenize';

type AssistantTask = Extract<GenerationTask, { kind: 'assistant' }>;
const cardFor = (pack: ContextPack, message: string) =>
  pack.characters.find((c) => { const re = buildNameRegex([c.name, ...c.aliases]); return re ? new RegExp(re.source, 'u').test(message) : false; }) ?? pack.characters[0];

export function localAssistantReply(t: AssistantTask): string {
  const p = t.pack;
  if (!p) return 'I need a novel context to answer.';
  if (t.mode === 'brainstorm') {
    const ideas: string[] = [];
    for (const c of p.characters) {
      if (c.goals) ideas.push(`${c.name} pushes toward their goal (“${c.goals}”) in a way that costs them something.`);
      if (c.fears) ideas.push(`${c.name} is forced to face their fear: ${c.fears}.`);
    }
    for (const r of p.relationships) ideas.push(r.isSecret ? `The secret — ${r.fromName} ${r.type} ${r.toName} — surfaces at the worst moment.` : `The ${r.type} between ${r.fromName} and ${r.toName} is tested.`);
    for (const e of p.timeline.slice(-3)) ideas.push(`A consequence of chapter ${e.chapterNumber} (“${e.description}”) returns.`);
    for (const r of p.retrieved.slice(0, 2)) ideas.push(`Something planted in chapter ${r.chapterNumber} pays off: “${r.content.split(/(?<=[.!?])\s/)[0]}”`);
    const picked = [...new Set(ideas)].slice(0, 5);
    return ['Ideas (not canon):', ...(picked.length ? picked.map((x, i) => `${i + 1}. ${x}`) : ['1. Add character goals, fears and relationships to the story bible so I can suggest grounded ideas.']),
      '', 'These are local, rule-based prompts. Connect an AI provider for richer brainstorming.'].join('\n');
  }
  if (t.mode === 'character') {
    const c = cardFor(p, t.message);
    if (!c) return 'No characters are involved yet. Add characters to the chapter or mention one by name.';
    const v = c.voice;
    return [
      `${c.name}${c.role ? ` — ${c.role}` : ''}`,
      c.personality && `Personality: ${c.personality}`, c.goals && `Goals: ${c.goals}`, c.fears && `Fears: ${c.fears}`,
      c.currentStatus && `Current status: ${c.currentStatus}`, c.currentLocation && `Last seen: ${c.currentLocation}`,
      `Voice: ${v.forming ? 'still forming' : `${v.register}, ${v.sentenceLength} lines`}${v.verbalTics.length ? `; tics: ${v.verbalTics.join(', ')}` : ''}${v.avoid.length ? `; never says: ${v.avoid.join(', ')}` : ''}`,
      v.sampleLines.length ? `Canon lines: ${v.sampleLines.map((s) => `“${s.quote}” (ch ${s.chapterNumber})`).join(' ')}` : '',
      c.recentEvents.length ? `Recent events:\n${c.recentEvents.map((e) => `- ${e}`).join('\n')}` : '',
      p.relationships.filter((r) => r.fromName === c.name || r.toName === c.name).map((r) => `- ${r.fromName} → ${r.type} → ${r.toName}${r.isSecret ? ' (secret)' : ''}`).join('\n'),
    ].filter(Boolean).join('\n');
  }
  // story_memory
  return [
    `What I remember for chapter ${p.chapter.number} of “${p.novel.title}”:`,
    p.recentChapters.length ? `Previous chapters: ${p.recentChapters.map((c) => `Chapter ${c.number} — ${c.summary || 'no summary'}`).join(' | ')}` : 'No approved chapters before this one yet.',
    p.retrieved.length ? `Relevant canon retrieved:\n${p.retrieved.map((r) => `- Chapter ${r.chapterNumber}: ${r.content.slice(0, 160)}…`).join('\n')}` : 'No older canon matched this chapter.',
    p.characters.length ? `Characters in focus: ${p.characters.map((c) => c.name).join(', ')}` : '',
    p.timeline.length ? `Timeline:\n${p.timeline.map((e) => `- Ch ${e.chapterNumber}: ${e.description}`).join('\n')}` : '',
    p.preferences.length ? `Active preferences:\n${p.preferences.map((x) => `- ${x.statement}`).join('\n')}` : 'No active writing preferences yet.',
    `Context used: ${p.budget.used}/${p.budget.limit} tokens${p.budget.trimmed.length ? ` (${p.budget.trimmed.length} lower-priority items trimmed)` : ''}.`,
  ].filter(Boolean).join('\n\n');
}
