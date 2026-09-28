import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { FeedbackTheme } from '../ai/types';
import { assertNovelOwner, assertRowInNovel } from '../services/access';
import { NotFoundError, ValidationError } from '../errors';
import { THEMES } from './themes';
import { getVoiceProfile } from '../voice/profile';
import { parse, longText } from '../validation';

export const PROMOTION = { candidateAt: 2, activeEvidence: 3, activeChapters: 2, characterEvidence: 2, characterChapters: 2 };
const VOICE_THEMES = new Set(['dialogue.too_formal', 'dialogue.too_casual', 'dialogue.same_voice', 'character.voice']);

export async function afterFeedbackThemes(db: DB, novelId: string, feedbackId: string, themes: FeedbackTheme[]) {
  const existing = await db.select().from(s.voiceNoteCandidates).where(eq(s.voiceNoteCandidates.feedbackId, feedbackId));
  for (const t of themes) {
    if (t.scope !== 'character' || !t.characterId || !VOICE_THEMES.has(t.themeKey)) continue;
    if (existing.some((e) => e.note === t.statement && e.characterId === t.characterId)) continue;
    await db.insert(s.voiceNoteCandidates).values({ novelId, characterId: t.characterId, feedbackId, note: t.statement });
  }
  await refreshPreferenceCandidates(db, novelId);
}

export async function refreshPreferenceCandidates(db: DB, novelId: string) {
  const agg = await db.select({
    themeKey: s.feedbackThemes.themeKey, scope: s.feedbackThemes.scope, characterId: s.feedbackThemes.characterId,
    n: sql<number>`count(*)::int`, chapters: sql<number>`count(distinct ${s.feedbackThemes.chapterId})::int`,
  }).from(s.feedbackThemes).where(and(eq(s.feedbackThemes.novelId, novelId), sql`${s.feedbackThemes.scope} <> 'chapter'`))
    .groupBy(s.feedbackThemes.themeKey, s.feedbackThemes.scope, s.feedbackThemes.characterId);
  const prefs = await db.select().from(s.writingPreferences).where(and(eq(s.writingPreferences.novelId, novelId), eq(s.writingPreferences.origin, 'extracted')));
  const chars = await db.select({ id: s.characters.id, name: s.characters.name }).from(s.characters).where(eq(s.characters.novelId, novelId));
  const seen = new Set<string>();
  for (const a of agg) {
    const scope = a.scope as 'global' | 'story' | 'character';
    const n = Number(a.n), chs = Number(a.chapters);
    const isChar = scope === 'character';
    const qualifies = isChar ? n >= PROMOTION.characterEvidence && chs >= PROMOTION.characterChapters : n >= PROMOTION.candidateAt;
    const status = !isChar && n >= PROMOTION.activeEvidence && chs >= PROMOTION.activeChapters ? 'active' : 'candidate';
    const prev = prefs.find((p) => p.themeKey === a.themeKey && p.scope === scope && (p.characterId ?? null) === (a.characterId ?? null));
    if (prev) seen.add(prev.id);
    if (!qualifies) continue;
    const base = THEMES[a.themeKey]?.statement ?? a.themeKey;
    const statement = isChar ? `${chars.find((c) => c.id === a.characterId)?.name ?? 'Character'}: ${base}` : base;
    if (prev) await db.update(s.writingPreferences).set({ evidenceCount: n, chaptersSeen: chs, ...(prev.statusSetByUser ? {} : { status }) }).where(eq(s.writingPreferences.id, prev.id));
    else await db.insert(s.writingPreferences).values({ novelId, scope, characterId: a.characterId, themeKey: a.themeKey, statement, evidenceCount: n, chaptersSeen: chs, status, origin: 'extracted' });
  }
  for (const p of prefs) {
    const a = agg.find((x) => x.themeKey === p.themeKey && x.scope === p.scope && (x.characterId ?? null) === (p.characterId ?? null));
    if ((!a || Number(a.n) < PROMOTION.candidateAt) && !p.statusSetByUser) await db.delete(s.writingPreferences).where(eq(s.writingPreferences.id, p.id));
  }
}

export async function listPreferences(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  const rows = await db.select({ p: s.writingPreferences, characterName: s.characters.name }).from(s.writingPreferences)
    .leftJoin(s.characters, eq(s.characters.id, s.writingPreferences.characterId)).where(eq(s.writingPreferences.novelId, novelId)).orderBy(asc(s.writingPreferences.createdAt));
  const all = rows.map((r) => ({ ...r.p, characterName: r.characterName ?? undefined }));
  const chapterNotes = await db.select({ chapterNumber: s.feedbackThemes.chapterNumber, statement: s.feedbackThemes.statement, themeKey: s.feedbackThemes.themeKey })
    .from(s.feedbackThemes).where(and(eq(s.feedbackThemes.novelId, novelId), eq(s.feedbackThemes.scope, 'chapter'))).orderBy(asc(s.feedbackThemes.chapterNumber));
  return { global: all.filter((p) => p.scope === 'global'), story: all.filter((p) => p.scope === 'story'), character: all.filter((p) => p.scope === 'character'), chapterNotes };
}

const statusSchema = z.enum(['candidate', 'active', 'dismissed']);
export async function setPreferenceStatus(db: DB, userId: string, prefId: string, status: z.input<typeof statusSchema>) {
  await assertRowInNovel(db, userId, s.writingPreferences, prefId, 'Preference');
  const [p] = await db.update(s.writingPreferences).set({ status: parse(statusSchema, status), statusSetByUser: true }).where(eq(s.writingPreferences.id, prefId)).returning();
  return p;
}
export async function updatePreference(db: DB, userId: string, prefId: string, patch: { statement?: string; pinned?: boolean }) {
  await assertRowInNovel(db, userId, s.writingPreferences, prefId, 'Preference');
  const data = parse(z.object({ statement: longText.min(1).optional(), pinned: z.boolean().optional() }), patch);
  const [p] = await db.update(s.writingPreferences).set({ ...data, statusSetByUser: true }).where(eq(s.writingPreferences.id, prefId)).returning();
  return p;
}
export async function createPreference(db: DB, userId: string, novelId: string, input: { scope: 'global' | 'story' | 'character'; statement: string; characterId?: string }) {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(z.object({ scope: z.enum(['global', 'story', 'character']), statement: longText.min(1), characterId: z.string().uuid().optional() }), input);
  if (data.scope === 'character') {
    if (!data.characterId) throw new ValidationError('Choose a character for a character preference');
    await assertRowInNovel(db, userId, s.characters, data.characterId, 'Character');
  }
  const [p] = await db.insert(s.writingPreferences).values({ novelId, ...data, characterId: data.characterId ?? null, status: 'active', statusSetByUser: true, origin: 'user' }).returning();
  return p;
}
export async function deletePreference(db: DB, userId: string, prefId: string) {
  await assertRowInNovel(db, userId, s.writingPreferences, prefId, 'Preference');
  await db.delete(s.writingPreferences).where(eq(s.writingPreferences.id, prefId));
}

export async function listVoiceNoteCandidates(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  return db.select().from(s.voiceNoteCandidates).where(and(eq(s.voiceNoteCandidates.novelId, novelId), eq(s.voiceNoteCandidates.status, 'pending'))).orderBy(asc(s.voiceNoteCandidates.createdAt));
}
export async function resolveVoiceNote(db: DB, userId: string, noteId: string, accept: boolean) {
  await assertRowInNovel(db, userId, s.voiceNoteCandidates, noteId, 'Voice note');
  const [n] = await db.select().from(s.voiceNoteCandidates).where(eq(s.voiceNoteCandidates.id, noteId));
  if (!n || n.status !== 'pending') throw new NotFoundError('Voice note');
  if (accept) {
    const prof = await getVoiceProfile(db, userId, n.characterId);
    const notes = [prof.userVoiceNotes, n.note].filter(Boolean).join('\n');
    await db.update(s.characterVoiceProfiles).set({ userVoiceNotes: notes }).where(eq(s.characterVoiceProfiles.characterId, n.characterId));
  }
  await db.update(s.voiceNoteCandidates).set({ status: accept ? 'accepted' : 'rejected' }).where(eq(s.voiceNoteCandidates.id, noteId));
}
