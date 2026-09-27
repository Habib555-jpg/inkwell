import { and, asc, desc, eq, inArray, isNull, max } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, getChapterForUser } from './access';
import { parse, shortText, longText } from '../validation';
import { ConflictError, ValidationError } from '../errors';

const list = z.array(longText.min(1)).max(50);
export const chapterRequirementsSchema = z.object({
  title: shortText.optional(),
  mainIdea: longText.optional(),
  requiredEvents: list.optional(),
  forbiddenEvents: list.optional(),
  characterIds: z.array(z.string().uuid()).max(50).optional(),
  tone: shortText.optional(),
  dialoguePoints: list.optional(),
  restrictions: longText.optional(),
  targetWords: z.number().int().min(200).max(20_000).nullable().optional(),
  instructions: longText.optional(),
});
export type ChapterRequirementsInput = z.input<typeof chapterRequirementsSchema>;
export type ChapterRequirements = {
  mainIdea: string; requiredEvents: string[]; forbiddenEvents: string[]; characterIds: string[];
  tone: string; dialoguePoints: string[]; restrictions: string; targetWords: number | null; instructions: string;
};
export const requirementsOf = (c: typeof s.chapters.$inferSelect): ChapterRequirements => ({
  mainIdea: c.mainIdea, requiredEvents: c.requiredEvents, forbiddenEvents: c.forbiddenEvents, characterIds: c.characterIds,
  tone: c.tone, dialoguePoints: c.dialoguePoints, restrictions: c.restrictions, targetWords: c.targetWords, instructions: c.instructions,
});

async function assertCharactersInNovel(db: DB, novelId: string, ids?: string[]) {
  if (!ids?.length) return;
  const rows = await db.select({ id: s.characters.id }).from(s.characters)
    .where(and(eq(s.characters.novelId, novelId), inArray(s.characters.id, ids)));
  if (rows.length !== new Set(ids).size) throw new ValidationError('All chapter characters must belong to this novel');
}

export async function createChapter(db: DB, userId: string, novelId: string, input: ChapterRequirementsInput & { number?: number }) {
  await assertNovelOwner(db, userId, novelId);
  const { number, ...rest } = input;
  const data = parse(chapterRequirementsSchema, rest);
  if (number !== undefined && (!Number.isInteger(number) || number < 1)) throw new ValidationError('Chapter number must be a positive integer');
  await assertCharactersInNovel(db, novelId, data.characterIds);
  const [{ m }] = await db.select({ m: max(s.chapters.number) }).from(s.chapters).where(eq(s.chapters.novelId, novelId));
  const num = number ?? (m ?? 0) + 1;
  const dup = await db.select({ id: s.chapters.id }).from(s.chapters).where(and(eq(s.chapters.novelId, novelId), eq(s.chapters.number, num)));
  if (dup.length) throw new ConflictError(`Chapter ${num} already exists`);
  const [c] = await db.insert(s.chapters).values({ ...data, novelId, number: num }).returning();
  return c;
}

export async function updateChapter(db: DB, userId: string, chapterId: string, patch: ChapterRequirementsInput) {
  const ch = await getChapterForUser(db, userId, chapterId);
  const data = parse(chapterRequirementsSchema, patch);
  await assertCharactersInNovel(db, ch.novelId, data.characterIds);
  const [c] = await db.update(s.chapters).set(data).where(eq(s.chapters.id, chapterId)).returning();
  return c;
}

export async function listChapters(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  return db.select().from(s.chapters).where(eq(s.chapters.novelId, novelId)).orderBy(asc(s.chapters.number));
}

export type VersionSummary = Pick<typeof s.chapterVersions.$inferSelect,
  'id' | 'versionNumber' | 'source' | 'isCanon' | 'wordCount' | 'createdAt' | 'updatedAt' | 'parentVersionId'>;

export async function getChapterDetail(db: DB, userId: string, chapterId: string) {
  const chapter = await getChapterForUser(db, userId, chapterId);
  const versions: VersionSummary[] = await db.select({
    id: s.chapterVersions.id, versionNumber: s.chapterVersions.versionNumber, source: s.chapterVersions.source,
    isCanon: s.chapterVersions.isCanon, wordCount: s.chapterVersions.wordCount, createdAt: s.chapterVersions.createdAt,
    updatedAt: s.chapterVersions.updatedAt, parentVersionId: s.chapterVersions.parentVersionId,
  }).from(s.chapterVersions)
    .where(and(eq(s.chapterVersions.chapterId, chapterId), isNull(s.chapterVersions.deletedAt)))
    .orderBy(desc(s.chapterVersions.versionNumber));
  return { chapter, versions };
}

export async function deleteChapter(db: DB, userId: string, chapterId: string) {
  const ch = await getChapterForUser(db, userId, chapterId);
  if (ch.approvedVersionId) throw new ConflictError('Approved chapters cannot be deleted; memory depends on them');
  await db.delete(s.chapters).where(eq(s.chapters.id, chapterId));
}
