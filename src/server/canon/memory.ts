import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from '../services/access';
import { parse, longText } from '../validation';

const cnt = (db: DB, table: typeof s.locations, novelId: string) => db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.novelId, novelId)).then((r) => Number(r[0].n));

export async function getMemoryOverview(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  const T = (t: unknown) => t as typeof s.locations;
  const [characters, relationships, locations, factions, worldRules, objects, timeline, chunks] = await Promise.all(
    [s.characters, s.characterRelationships, s.locations, s.factions, s.worldRules, s.storyObjects, s.timelineEvents, s.memoryChunks].map((t) => cnt(db, T(t), novelId)));
  const [{ n: preferencesActive }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.writingPreferences).where(and(eq(s.writingPreferences.novelId, novelId), eq(s.writingPreferences.status, 'active')));
  const [{ n: conflictsOpen }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.memoryConflicts).where(and(eq(s.memoryConflicts.novelId, novelId), eq(s.memoryConflicts.status, 'open')));
  const canon = await db.select({ c: s.chapters, v: s.chapterVersions, sm: s.chapterSummaries }).from(s.chapters)
    .innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.chapters.approvedVersionId))
    .leftJoin(s.chapterSummaries, eq(s.chapterSummaries.chapterVersionId, s.chapterVersions.id))
    .where(and(eq(s.chapters.novelId, novelId), isNotNull(s.chapters.approvedVersionId))).orderBy(asc(s.chapters.number));
  const facts = await db.select({ id: s.chapterFacts.id, chapterNumber: s.chapterFacts.chapterNumber, kind: s.chapterFacts.kind, content: s.chapterFacts.content })
    .from(s.chapterFacts).where(eq(s.chapterFacts.novelId, novelId)).orderBy(asc(s.chapterFacts.chapterNumber));
  return {
    counts: { characters, relationships, locations, factions, worldRules, objects, timeline, chunks, canonChapters: canon.length, preferencesActive: Number(preferencesActive), conflictsOpen: Number(conflictsOpen) },
    canonChapters: canon.map(({ c, v, sm }) => ({ chapterId: c.id, number: c.number, title: c.title, summaryId: sm?.id ?? null, summary: sm?.summary ?? '', keyEvents: sm?.keyEvents ?? [], keywords: sm?.keywords ?? [], wordCount: v.wordCount, extractionStatus: c.extractionStatus, approvedAt: v.updatedAt })),
    facts: facts.filter((f) => f.kind !== 'character_state').concat(facts.filter((f) => f.kind === 'character_state').map((f) => { const j = JSON.parse(f.content); return { ...f, content: `${j.name}: ${j.field === 'currentStatus' ? 'status' : 'location'} → ${j.to}` }; })),
  };
}
export async function updateSummary(db: DB, userId: string, summaryId: string, summary: string) {
  await assertRowInNovel(db, userId, s.chapterSummaries, summaryId, 'Summary');
  await db.update(s.chapterSummaries).set({ summary: parse(longText.min(1), summary) }).where(eq(s.chapterSummaries.id, summaryId));
}
export async function deleteChunk(db: DB, userId: string, chunkId: string) {
  await assertRowInNovel(db, userId, s.memoryChunks, chunkId, 'Memory chunk');
  await db.delete(s.memoryChunks).where(eq(s.memoryChunks.id, chunkId));
}
export async function deleteFact(db: DB, userId: string, factId: string) {
  await assertRowInNovel(db, userId, s.chapterFacts, factId, 'Fact');
  await db.delete(s.chapterFacts).where(eq(s.chapterFacts.id, factId));
}
export async function listChunks(db: DB, userId: string, novelId: string, o: { chapterNumber?: number; limit?: number; offset?: number }) {
  await assertNovelOwner(db, userId, novelId);
  const q = parse(z.object({ chapterNumber: z.number().int().optional(), limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }), o);
  const where = q.chapterNumber ? and(eq(s.memoryChunks.novelId, novelId), eq(s.memoryChunks.chapterNumber, q.chapterNumber)) : eq(s.memoryChunks.novelId, novelId);
  return db.select({ id: s.memoryChunks.id, chapterNumber: s.memoryChunks.chapterNumber, chunkIndex: s.memoryChunks.chunkIndex, content: s.memoryChunks.content, keywords: s.memoryChunks.keywords, embeddingModel: s.memoryChunks.embeddingModel })
    .from(s.memoryChunks).where(where).orderBy(asc(s.memoryChunks.chapterNumber), asc(s.memoryChunks.chunkIndex)).limit(q.limit).offset(q.offset);
}
