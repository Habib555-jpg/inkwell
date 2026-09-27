import { and, eq, isNull, max } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { getChapterForUser, getVersionForUser, type Chapter, type ChapterVersion } from './access';
import { parse, chapterContent } from '../validation';
import { ConflictError } from '../errors';
import { countWords } from '@/lib/text-stats';
import { diffWords } from '@/lib/diff';

type Source = (typeof s.versionSourceEnum.enumValues)[number];

/** Internal: no auth check. Callers must have resolved `chapter` via an owner-scoped lookup. */
export async function insertVersion(db: DB, p: {
  chapter: Chapter; content: string; source: Source; parentVersionId?: string | null;
  generationMeta?: Record<string, unknown>; continuityReport?: unknown; criticReport?: unknown;
}): Promise<ChapterVersion> {
  const content = parse(chapterContent, p.content);
  return db.transaction(async (tx) => {
    const [{ m }] = await tx.select({ m: max(s.chapterVersions.versionNumber) }).from(s.chapterVersions).where(eq(s.chapterVersions.chapterId, p.chapter.id));
    const [v] = await tx.insert(s.chapterVersions).values({
      chapterId: p.chapter.id, novelId: p.chapter.novelId, versionNumber: (m ?? 0) + 1, content, wordCount: countWords(content),
      source: p.source, parentVersionId: p.parentVersionId ?? null, generationMeta: p.generationMeta ?? {},
      continuityReport: p.continuityReport ?? null, criticReport: p.criticReport ?? null,
    }).returning();
    const [fresh] = await tx.select().from(s.chapters).where(eq(s.chapters.id, p.chapter.id));
    const status = fresh.approvedVersionId && fresh.approvedVersionId !== v.id ? 'canon_changed' : 'drafting';
    await tx.update(s.chapters).set({ currentVersionId: v.id, status }).where(eq(s.chapters.id, p.chapter.id));
    return v;
  });
}

export async function saveManualVersion(db: DB, userId: string, chapterId: string, content: string) {
  const chapter = await getChapterForUser(db, userId, chapterId);
  return insertVersion(db, { chapter, content, source: 'manual', parentVersionId: chapter.currentVersionId });
}

export async function getVersion(db: DB, userId: string, versionId: string) {
  return (await getVersionForUser(db, userId, versionId)).version;
}

export async function autosaveVersion(db: DB, userId: string, versionId: string, content: string): Promise<{ version: ChapterVersion; forked: boolean }> {
  const { version, chapter } = await getVersionForUser(db, userId, versionId);
  const text = parse(chapterContent, content);
  const children = await db.select({ id: s.chapterVersions.id }).from(s.chapterVersions)
    .where(and(eq(s.chapterVersions.parentVersionId, versionId), isNull(s.chapterVersions.deletedAt)));
  const inPlace = version.source === 'manual' && !version.isCanon && chapter.currentVersionId === version.id
    && chapter.approvedVersionId !== version.id && children.length === 0;
  if (inPlace) {
    const [v] = await db.update(s.chapterVersions).set({ content: text, wordCount: countWords(text) })
      .where(and(eq(s.chapterVersions.id, versionId), eq(s.chapterVersions.isCanon, false))).returning();
    if (v) return { version: v, forked: false };
  }
  const v = await insertVersion(db, { chapter, content: text, source: 'manual', parentVersionId: versionId });
  return { version: v, forked: true };
}

export async function restoreVersion(db: DB, userId: string, versionId: string) {
  const { version, chapter } = await getVersionForUser(db, userId, versionId);
  return insertVersion(db, { chapter, content: version.content, source: 'restored', parentVersionId: version.id });
}

export async function setCurrentVersion(db: DB, userId: string, versionId: string) {
  const { version, chapter } = await getVersionForUser(db, userId, versionId);
  const status = chapter.approvedVersionId ? (chapter.approvedVersionId === version.id ? 'approved' : 'canon_changed') : 'drafting';
  await db.update(s.chapters).set({ currentVersionId: version.id, status }).where(eq(s.chapters.id, chapter.id));
}

export async function deleteVersion(db: DB, userId: string, versionId: string) {
  const { version, chapter } = await getVersionForUser(db, userId, versionId);
  if (version.isCanon || chapter.approvedVersionId === version.id) throw new ConflictError('The approved canon version cannot be deleted');
  if (chapter.currentVersionId === version.id) throw new ConflictError('Switch to another version before deleting this one');
  await db.update(s.chapterVersions).set({ deletedAt: new Date() }).where(eq(s.chapterVersions.id, versionId));
}

export async function compareVersions(db: DB, userId: string, aId: string, bId: string) {
  const a = await getVersion(db, userId, aId);
  const b = await getVersion(db, userId, bId);
  if (a.chapterId !== b.chapterId) throw new ConflictError('Versions belong to different chapters');
  return { a, b, diff: diffWords(a.content, b.content) };
}
