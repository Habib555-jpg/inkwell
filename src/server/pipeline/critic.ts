import type { Issue } from '../ai/types';
import type { ContextPack } from '../memory/types';
import { attributeDialogue, findQuotes } from '../text/dialogue';
import { lineStats, statVector, dialogueRatio, ABSTRACT_WORDS } from '../text/style';
import { dominantEmotion, NEGATIVE_EMOTIONS } from '../text/emotion';
import { buildNameRegex, splitParagraphs, splitSentences, tokenOverlap, words } from '../text/tokenize';
import { checkRequiredEvents } from './continuity';

export const CRITIC_CATEGORIES = ['voice_drift', 'voices_too_similar', 'uniform_eloquence', 'emotional_discontinuity', 'pacing_length', 'pacing_dialogue_ratio',
  'pacing_event_balance', 'pacing_exposition_run', 'repetition', 'missing_required_event', 'weak_scene', 'unnecessary_scene'] as const;
export interface CriticMetrics {
  wordCount: number; targetWords: number; dialogueRatio: number; targetDialogueRange: [number, number];
  avgSentenceLength: number; sentenceLengthStdDev: number;
  perCharacter: { characterId: string; name: string; lines: number; formality: number; avgWords: number }[];
}
export interface CriticReport { issues: Issue[]; metrics: CriticMetrics; summary: string }
const RANGES = { dialogue_heavy: [0.45, 1], balanced: [0.25, 0.45], narration_heavy: [0, 0.25] } as const;
const BRIDGE = /\b(despite|finally|at last|relief|relieved|healed|recovered|forgave|forgiven|(?:days|weeks|months|years) later|time passed)\b/i;
const ACTION_VERB = /\b(ran|grabbed|struck|drew|jumped|fell|shouted|fought|pushed|pulled|turned|opened|slammed|fled|attacked|kissed|threw|caught)\b/i;

export function runCritic(draft: string, pack: ContextPack): CriticReport {
  const issues: Issue[] = [...checkRequiredEvents(draft, pack.chapter.requiredEvents)];
  const cast = pack.characters;
  const lines = attributeDialogue(draft, cast.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] })));
  const byChar = new Map<string, string[]>();
  for (const l of lines) if (l.speakerId) byChar.set(l.speakerId, [...(byChar.get(l.speakerId) ?? []), l.text]);
  const perCharacter = [...byChar.entries()].map(([id, ls]) => { const st = lineStats(ls); return { characterId: id, name: cast.find((c) => c.id === id)?.name ?? id, lines: ls.length, formality: st.formality, avgWords: st.avgWordsPerLine, st, ls }; });

  for (const pc of perCharacter) {
    const v = cast.find((c) => c.id === pc.characterId)?.voice; if (!v || pc.lines < 2) continue;
    const avoidHit = pc.ls.find((l) => v.avoid.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(l)));
    const reasons: string[] = [];
    if (v.lineCount >= 5 && v.formality !== undefined && Math.abs(pc.formality - v.formality) > 0.3) reasons.push(`formality ${pc.formality.toFixed(2)} vs usual ${v.formality.toFixed(2)}`);
    if (v.lineCount >= 5 && v.avgWordsPerLine && (pc.avgWords / v.avgWordsPerLine > 2 || pc.avgWords / v.avgWordsPerLine < 0.5)) reasons.push(`${pc.avgWords.toFixed(0)} words/line vs usual ${v.avgWordsPerLine.toFixed(0)}`);
    if (avoidHit) reasons.push('uses a word they never use');
    if (reasons.length) issues.push({ severity: 'warning', category: 'voice_drift', characterId: pc.characterId, message: `${pc.name} doesn't sound like themselves: ${reasons.join('; ')}.`, evidence: { draftQuote: avoidHit ?? pc.ls[0] } });
  }
  const eligible = perCharacter.filter((p) => p.lines >= 3);
  for (let a = 0; a < eligible.length; a++) for (let b = a + 1; b < eligible.length; b++) {
    const va = statVector(eligible[a].st), vb = statVector(eligible[b].st);
    const dist = Math.hypot(...va.map((x, i) => x - vb[i]));
    if (dist < 0.12) issues.push({ severity: 'warning', category: 'voices_too_similar', message: `${eligible[a].name} and ${eligible[b].name} sound alike (style distance ${dist.toFixed(2)}).`, evidence: { draftQuote: `${eligible[a].ls[0]} / ${eligible[b].ls[0]}` } });
  }
  const allLines = lines.map((l) => l.text);
  if (allLines.length >= 4) {
    const longShare = allLines.filter((l) => words(l).length > 20).length / allLines.length;
    const abstract = allLines.flatMap(words).filter((w) => ABSTRACT_WORDS.has(w.toLowerCase())).length / Math.max(1, allLines.flatMap(words).length);
    if (longShare >= 0.6 || abstract >= 0.02) issues.push({ severity: 'warning', category: 'uniform_eloquence', message: `Dialogue is uniformly long or philosophical (${Math.round(longShare * 100)}% of lines over 20 words). Real speech is shorter and messier.` });
  }
  const sentences = splitSentences(draft);
  for (const c of cast) {
    const canonMood = dominantEmotion([c.currentStatus, c.voice.emotionalBaseline, ...c.recentEvents].join(' '), 1);
    if (!canonMood || !NEGATIVE_EMOTIONS.has(canonMood)) continue;
    const re = buildNameRegex([c.name, ...c.aliases]); if (!re) continue;
    const about = sentences.filter((s) => new RegExp(re.source, 'u').test(s)).join(' ');
    if (dominantEmotion(about, 2) === 'joy' && !BRIDGE.test(draft))
      issues.push({ severity: 'warning', category: 'emotional_discontinuity', characterId: c.id, message: `${c.name} was last in a ${canonMood} state in canon, but is joyful here with no bridging moment.` });
  }
  const wordCount = words(draft).length;
  const target = pack.chapter.targetWords ?? pack.novel.targetWords;
  if (Math.abs(wordCount - target) / target > 0.25) issues.push({ severity: 'warning', category: 'pacing_length', message: `Length is ${wordCount} words vs target ${target}.` });
  const ratio = dialogueRatio(draft); const [lo, hi] = RANGES[pack.novel.dialogueBalance];
  if (ratio < lo || ratio > hi) issues.push({ severity: 'warning', category: 'pacing_dialogue_ratio', message: `Dialogue is ${Math.round(ratio * 100)}% of words; setting "${pack.novel.dialogueBalance.replace('_', ' ')}" expects ${Math.round(lo * 100)}–${Math.round(hi * 100)}%.` });
  const paras = splitParagraphs(draft);
  const evs = pack.chapter.requiredEvents;
  if (evs.length >= 2) {
    const share = new Array(evs.length).fill(0);
    for (const p of paras) { const scores = evs.map((e) => tokenOverlap(e, p)); const best = scores.indexOf(Math.max(...scores)); if (scores[best] > 0) share[best] += words(p).length; }
    const total = share.reduce((a, b) => a + b, 0) || 1;
    share.forEach((s, i) => { if (s / total > 0.5 && paras.length > 3) issues.push({ severity: 'warning', category: 'pacing_event_balance', message: `“${evs[i]}” takes ${Math.round((s / total) * 100)}% of the event coverage; the other events feel rushed.` }); });
  }
  let run = 0;
  for (const p of paras) { run = findQuotes(p).length || ACTION_VERB.test(p) ? 0 : run + 1; if (run === 5) issues.push({ severity: 'info', category: 'pacing_exposition_run', message: 'Five or more consecutive paragraphs of exposition with no dialogue or action.', evidence: { draftQuote: p.slice(0, 160) } }); }
  const openers = new Map<string, number>();
  for (const s of sentences) { const k = words(s).slice(0, 2).join(' ').toLowerCase(); if (k) openers.set(k, (openers.get(k) ?? 0) + 1); }
  for (const [k, n] of openers) if (n > 3) issues.push({ severity: 'info', category: 'repetition', message: `${n} sentences start with “${k}…”.` });
  const outside = paras.map((p) => { let t = p; for (const q of findQuotes(p).reverse()) t = t.slice(0, q.index) + t.slice(q.end); return t; }).join(' ');
  const grams = new Map<string, number>(); const ws = words(outside).map((w) => w.toLowerCase());
  for (let i = 0; i + 4 <= ws.length; i++) { const g = ws.slice(i, i + 4).join(' '); grams.set(g, (grams.get(g) ?? 0) + 1); }
  const rep = [...grams.entries()].filter(([, n]) => n > 2).map(([g]) => g).slice(0, 3);
  if (rep.length) issues.push({ severity: 'info', category: 'repetition', message: `Repeated phrasing: ${rep.map((g) => `“${g}”`).join(', ')}.` });
  const scenes = /^(\* \* \*|#{1,3} |Scene \d+)/m.test(draft)
    ? draft.split(/^(?=\* \* \*|#{1,3} |Scene \d+)/m).map((x) => x.trim()).filter(Boolean)
    : Array.from({ length: Math.ceil(paras.length / 5) }, (_, i) => paras.slice(i * 5, i * 5 + 5).join('\n\n'));
  const involvedRe = buildNameRegex(cast.flatMap((c) => [c.name, ...c.aliases]));
  scenes.forEach((sc, i) => {
    const cover = Math.max(0, ...evs.map((e) => tokenOverlap(e, sc)));
    if (evs.length && cover >= 0.5 && words(sc).length < 60) issues.push({ severity: 'info', category: 'weak_scene', message: `Scene ${i + 1} carries a required event in under 60 words.` });
    if (evs.length && cover < 0.3 && !findQuotes(sc).length && !(involvedRe && new RegExp(involvedRe.source, 'u').test(sc)))
      issues.push({ severity: 'info', category: 'unnecessary_scene', message: `Scene ${i + 1} doesn't advance a required event or involve the chapter's characters.` });
  });
  const lens = sentences.map((s) => words(s).length); const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, lens.length));
  const counts = issues.reduce<Record<string, number>>((a, x) => ((a[x.category] = (a[x.category] ?? 0) + 1), a), {});
  const summary = issues.length ? `${issues.length} findings: ${Object.entries(counts).map(([k, n]) => `${n} ${k.replaceAll('_', ' ')}`).join(', ')}.`
    : `No rule-based problems found in ${wordCount} words (${Math.round(ratio * 100)}% dialogue, avg sentence ${avg.toFixed(1)} words). Read for voice and subtext; rules cannot judge prose quality.`;
  return {
    issues, summary,
    metrics: { wordCount, targetWords: target, dialogueRatio: ratio, targetDialogueRange: [lo, hi], avgSentenceLength: avg, sentenceLengthStdDev: sd,
      perCharacter: perCharacter.map(({ st: _s, ls: _l, ...rest }) => rest) },
  };
}
