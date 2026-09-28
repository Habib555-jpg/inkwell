import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertRowInNovel } from '../services/access';
import { ConflictError } from '../errors';
import { attributeDialogue } from '../text/dialogue';
import { lineStats, registerFor, sentenceLengthFor } from '../text/style';
import { dominantEmotion } from '../text/emotion';
import { contentTokens, words } from '../text/tokenize';
import { parse, shortText, longText } from '../validation';

export const LOCKABLE_FIELDS = ['register', 'sentenceLength', 'emotionalBaseline', 'verbalTics', 'avoid', 'sampleLines', 'relationshipRegisters'] as const;
type Lockable = (typeof LOCKABLE_FIELDS)[number];

export async function harvestDialogueLines(db: DB, v: { novelId: string; versionId: string; chapterNumber: number; content: string }) {
  const [ver] = await db.select({ isCanon: s.chapterVersions.isCanon }).from(s.chapterVersions).where(eq(s.chapterVersions.id, v.versionId));
  if (!ver?.isCanon) throw new ConflictError('Voice profiles only learn from approved canon');
  const chars = await db.select().from(s.characters).where(eq(s.characters.novelId, v.novelId));
  // First names act as implicit aliases ("Mira" for "Mira Vale") only when no two characters share one.
  const firstCount = new Map<string, number>();
  for (const c of chars) { const f = c.name.split(' ')[0]; firstCount.set(f, (firstCount.get(f) ?? 0) + 1); }
  const cast = chars.map((c) => {
    const first = c.name.split(' ')[0];
    return { id: c.id, names: [c.name, ...c.aliases, ...(firstCount.get(first) === 1 ? [first] : [])] };
  });
  const lines = attributeDialogue(v.content, cast).filter((l) => l.speakerId);
  await db.delete(s.dialogueLines).where(eq(s.dialogueLines.chapterVersionId, v.versionId));
  if (lines.length) await db.insert(s.dialogueLines).values(lines.map((l) => ({
    novelId: v.novelId, chapterVersionId: v.versionId, characterId: l.speakerId!, addresseeId: l.addresseeId, chapterNumber: v.chapterNumber, line: l.text,
  })));
  return lines.length;
}
export const removeDialogueForVersion = (db: DB, versionId: string) => db.delete(s.dialogueLines).where(eq(s.dialogueLines.chapterVersionId, versionId));

const ngrams = (line: string, n: number) => { const ws = words(line).map((w) => w.toLowerCase()); return ws.slice(0, Math.max(0, ws.length - n + 1)).map((_, i) => ws.slice(i, i + n).join(' ')); };

export async function recomputeVoiceProfiles(db: DB, novelId: string, characterIds?: string[]) {
  const chars = await db.select().from(s.characters).where(eq(s.characters.novelId, novelId));
  const nameById = new Map(chars.map((c) => [c.id, c.name]));
  const rows = await db.select({ d: s.dialogueLines }).from(s.dialogueLines)
    .innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.dialogueLines.chapterVersionId))
    .where(and(eq(s.dialogueLines.novelId, novelId), eq(s.chapterVersions.isCanon, true)));
  const byChar = new Map<string, typeof rows[number]['d'][]>();
  for (const { d } of rows) byChar.set(d.characterId, [...(byChar.get(d.characterId) ?? []), d]);
  const speakers = [...byChar.keys()];
  const df = new Map<string, number>(); const phraseUsers = new Map<string, Set<string>>();
  for (const [cid, ls] of byChar) {
    for (const t of new Set(ls.flatMap((l) => contentTokens(l.line)))) df.set(t, (df.get(t) ?? 0) + 1);
    for (const p of new Set(ls.flatMap((l) => [...ngrams(l.line, 2), ...ngrams(l.line, 3)]))) phraseUsers.set(p, new Set([...(phraseUsers.get(p) ?? []), cid]));
  }
  const targets = chars.filter((c) => !characterIds || characterIds.includes(c.id));
  const existing = await db.select().from(s.characterVoiceProfiles).where(eq(s.characterVoiceProfiles.novelId, novelId));

  for (const c of targets) {
    const ls = byChar.get(c.id) ?? [];
    const texts = ls.map((l) => l.line);
    const st = lineStats(texts);
    const tf = new Map<string, { n: number; surface: string }>();
    for (const t of texts) for (const w of words(t)) { const [k] = contentTokens(w); if (!k) continue; const e = tf.get(k) ?? { n: 0, surface: w.toLowerCase() }; e.n++; tf.set(k, e); }
    const C = speakers.length;
    const lexical = [...tf.entries()].map(([k, e]) => ({ w: e.surface, score: e.n * Math.log((C + 1) / ((df.get(k) ?? 0) + 1)) + e.n * 0.01 }))
      .sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.w);
    const counts = new Map<string, number>();
    for (const t of texts) for (const p of [...ngrams(t, 2), ...ngrams(t, 3)]) counts.set(p, (counts.get(p) ?? 0) + 1);
    // keep phrases this character repeats (≥2) and at most one other speaker uses; must carry a content word unless used ≥3 times
    const phrases = [...counts.entries()].filter(([p, n]) => n >= 2 && (phraseUsers.get(p)?.size ?? 1) <= 2 && (contentTokens(p).length > 0 || n >= 3))
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([p]) => p).slice(0, 5);
    const openers = new Map<string, number>();
    for (const t of texts) { const m = t.match(/^([\p{L}’']+)[,.!]/u); if (m) openers.set(m[1], (openers.get(m[1]) ?? 0) + 1); }
    const openerTics = texts.length >= 5 ? [...openers.entries()].filter(([, n]) => n / texts.length >= 0.3).map(([w]) => w) : [];
    const sigSet = new Set([...lexical, ...phrases]);
    const samples = texts.map((t, i) => ({ t, i, n: words(t).length, score: [...sigSet].filter((x) => t.toLowerCase().includes(x)).length }))
      .filter((x) => x.n >= 1 && x.n <= 30).sort((a, b) => b.score - a.score || a.i - b.i);
    const seen = new Set<string>(); const sampleLines: { quote: string; chapterNumber: number }[] = [];
    for (const x of samples) { if (seen.has(x.t)) continue; seen.add(x.t); sampleLines.push({ quote: x.t, chapterNumber: ls[x.i].chapterNumber }); if (sampleLines.length >= 5) break; }
    const byAddressee = new Map<string, string[]>();
    for (const l of ls) if (l.addresseeId) byAddressee.set(l.addresseeId, [...(byAddressee.get(l.addresseeId) ?? []), l.line]);
    const relationshipRegisters = [...byAddressee.entries()].filter(([, v]) => v.length >= 3).map(([to, v]) => {
      const f = lineStats(v).formality, d = f - st.formality, name = nameById.get(to) ?? 'them';
      return { toCharacterId: to, note: Math.abs(d) >= 0.15 ? `${d > 0 ? 'more formal' : 'more casual'} with ${name} (${f.toFixed(2)} vs ${st.formality.toFixed(2)})` : `same register with ${name}` };
    });
    const derived = {
      register: texts.length ? registerFor(st, texts) : '', sentenceLength: texts.length ? sentenceLengthFor(st.avgWordsPerLine) : '',
      emotionalBaseline: texts.length ? dominantEmotion(texts.join(' '), 3) ?? 'even' : '',
      verbalTics: [...new Set([...openerTics, ...phrases.slice(0, 3)])], avoid: [] as string[], sampleLines, relationshipRegisters,
    };
    const prev = existing.find((p) => p.characterId === c.id);
    const locked = new Set(prev?.lockedFields ?? []);
    const pick = <K extends Lockable>(k: K) => (locked.has(k) && prev ? prev[k] : k === 'avoid' ? prev?.avoid ?? [] : derived[k]);
    const values = {
      characterId: c.id, novelId, register: pick('register') as string, sentenceLength: pick('sentenceLength') as string,
      emotionalBaseline: pick('emotionalBaseline') as string, verbalTics: pick('verbalTics') as string[], avoid: pick('avoid') as string[],
      sampleLines: pick('sampleLines') as { quote: string; chapterNumber: number }[],
      relationshipRegisters: pick('relationshipRegisters') as { toCharacterId: string; note: string }[],
      stats: { ...st } as unknown as Record<string, number>, lexicalSignature: lexical, signaturePhrases: phrases, lineCount: texts.length,
    };
    await db.insert(s.characterVoiceProfiles).values(values).onConflictDoUpdate({ target: s.characterVoiceProfiles.characterId, set: values });
  }
}

export async function getVoiceProfile(db: DB, userId: string, characterId: string) {
  const novelId = await assertRowInNovel(db, userId, s.characters, characterId, 'Character');
  const [p] = await db.select().from(s.characterVoiceProfiles).where(eq(s.characterVoiceProfiles.characterId, characterId));
  if (p) return p;
  await recomputeVoiceProfiles(db, novelId, [characterId]);
  const [q] = await db.select().from(s.characterVoiceProfiles).where(eq(s.characterVoiceProfiles.characterId, characterId));
  return q;
}

export const voicePatchSchema = z.object({
  userVoiceNotes: longText.optional(), register: shortText.optional(), sentenceLength: shortText.optional(), emotionalBaseline: shortText.optional(),
  verbalTics: z.array(shortText).max(20).optional(), avoid: z.array(shortText).max(50).optional(),
  sampleLines: z.array(z.object({ quote: shortText.max(500), chapterNumber: z.number().int() })).max(10).optional(),
  pinnedSamples: z.array(z.object({ quote: z.string().max(500), chapterNumber: z.number().int() })).max(10).optional(),
  relationshipRegisters: z.array(z.object({ toCharacterId: z.string().uuid(), note: shortText })).max(30).optional(),
});
export type VoicePatch = z.infer<typeof voicePatchSchema>;

export async function updateVoiceProfile(db: DB, userId: string, characterId: string, patch: VoicePatch) {
  const current = await getVoiceProfile(db, userId, characterId);
  const data = parse(voicePatchSchema, patch);
  const newlyLocked = LOCKABLE_FIELDS.filter((f) => f in data);
  const [p] = await db.update(s.characterVoiceProfiles)
    .set({ ...data, lockedFields: [...new Set([...current.lockedFields, ...newlyLocked])] })
    .where(eq(s.characterVoiceProfiles.characterId, characterId)).returning();
  return p;
}
export async function resetVoiceField(db: DB, userId: string, characterId: string, field: Lockable) {
  const current = await getVoiceProfile(db, userId, characterId);
  await db.update(s.characterVoiceProfiles).set({ lockedFields: current.lockedFields.filter((f) => f !== field) }).where(eq(s.characterVoiceProfiles.characterId, characterId));
  await recomputeVoiceProfiles(db, current.novelId, [characterId]);
}
