import { desc, eq, sql } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner } from './access';
import { parse, novelInputSchema, novelSettingsSchema, type NovelInput } from '../validation';

export async function createNovel(db: DB, userId: string, input: NovelInput) {
  const data = parse(novelInputSchema, input);
  return db.transaction(async (tx) => {
    const [n] = await tx.insert(s.novels).values({ ...data, ownerId: userId }).returning();
    await tx.insert(s.novelSettings).values({ novelId: n.id });
    return n;
  });
}
export const listNovels = (db: DB, userId: string) =>
  db.select().from(s.novels).where(eq(s.novels.ownerId, userId)).orderBy(desc(s.novels.updatedAt));

export async function getNovel(db: DB, userId: string, novelId: string) {
  const novel = await assertNovelOwner(db, userId, novelId);
  const [settings] = await db.select().from(s.novelSettings).where(eq(s.novelSettings.novelId, novelId));
  return { novel, settings };
}
export async function updateNovel(db: DB, userId: string, novelId: string, patch: Partial<NovelInput>) {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(novelInputSchema.partial(), patch);
  const [n] = await db.update(s.novels).set(data).where(eq(s.novels.id, novelId)).returning();
  return n;
}
export async function updateNovelSettings(db: DB, userId: string, novelId: string, patch: unknown) {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(novelSettingsSchema, patch);
  const [st] = await db.update(s.novelSettings).set(data).where(eq(s.novelSettings.novelId, novelId)).returning();
  return st;
}
export async function deleteNovel(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  await db.delete(s.novels).where(eq(s.novels.id, novelId));
}

/** Novel list with chapter/canon counts for dashboards (owner-scoped). */
export async function listNovelSummaries(db: DB, userId: string) {
  const rows = await db.select({
    id: s.novels.id, title: s.novels.title, genre: s.novels.genre, premise: s.novels.premise, updatedAt: s.novels.updatedAt,
    chapterCount: sql<number>`(select count(*)::int from chapters c where c.novel_id = "novels"."id")`,
    canonCount: sql<number>`(select count(*)::int from chapters c where c.novel_id = "novels"."id" and c.approved_version_id is not null)`,
    openConflicts: sql<number>`(select count(*)::int from memory_conflicts m where m.novel_id = "novels"."id" and m.status = 'open')`,
  }).from(s.novels).where(eq(s.novels.ownerId, userId)).orderBy(desc(s.novels.updatedAt));
  return rows.map((r) => ({ ...r, chapterCount: Number(r.chapterCount), canonCount: Number(r.canonCount), openConflicts: Number(r.openConflicts) }));
}
