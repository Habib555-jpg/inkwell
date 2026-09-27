import { and, eq, isNull } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { NotFoundError } from '../errors';
import { isUuid } from '../validation';

export type Novel = typeof s.novels.$inferSelect;
export type Chapter = typeof s.chapters.$inferSelect;
export type ChapterVersion = typeof s.chapterVersions.$inferSelect;

export async function assertNovelOwner(db: DB, userId: string, novelId: string): Promise<Novel> {
  if (!isUuid(novelId)) throw new NotFoundError('Novel');
  const [n] = await db.select().from(s.novels).where(and(eq(s.novels.id, novelId), eq(s.novels.ownerId, userId)));
  if (!n) throw new NotFoundError('Novel');
  return n;
}

export async function getChapterForUser(db: DB, userId: string, chapterId: string): Promise<Chapter> {
  if (!isUuid(chapterId)) throw new NotFoundError('Chapter');
  const rows = await db.select({ c: s.chapters }).from(s.chapters)
    .innerJoin(s.novels, eq(s.novels.id, s.chapters.novelId))
    .where(and(eq(s.chapters.id, chapterId), eq(s.novels.ownerId, userId)));
  if (!rows[0]) throw new NotFoundError('Chapter');
  return rows[0].c;
}

export async function getVersionForUser(db: DB, userId: string, versionId: string): Promise<{ version: ChapterVersion; chapter: Chapter }> {
  if (!isUuid(versionId)) throw new NotFoundError('Version');
  const rows = await db.select({ v: s.chapterVersions, c: s.chapters }).from(s.chapterVersions)
    .innerJoin(s.chapters, eq(s.chapters.id, s.chapterVersions.chapterId))
    .innerJoin(s.novels, eq(s.novels.id, s.chapterVersions.novelId))
    .where(and(eq(s.chapterVersions.id, versionId), eq(s.novels.ownerId, userId), isNull(s.chapterVersions.deletedAt)));
  if (!rows[0]) throw new NotFoundError('Version');
  return { version: rows[0].v, chapter: rows[0].c };
}

/** Generic guard for novel-owned rows (characters, locations, ...). Returns the row's novelId. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NovelOwnedTable = any; // any drizzle table with `id` and `novelId` columns
export async function assertRowInNovel(db: DB, userId: string, table: NovelOwnedTable, rowId: string, what: string): Promise<string> {
  if (!isUuid(rowId)) throw new NotFoundError(what);
  const rows = await db.select({ novelId: table.novelId }).from(table)
    .innerJoin(s.novels, eq(s.novels.id, table.novelId))
    .where(and(eq(table.id, rowId), eq(s.novels.ownerId, userId)));
  if (!rows[0]) throw new NotFoundError(what);
  return rows[0].novelId as string;
}
