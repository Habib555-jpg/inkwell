import { and, eq, max, isNotNull } from 'drizzle-orm';
import * as s from '../db/schema';
import type { AppContext } from '../context';
import { getChapterForUser, getVersionForUser, type Chapter, type ChapterVersion } from '../services/access';
import { ConflictError, ValidationError } from '../errors';
import { LOCAL_DRAFT_LABEL } from '../ai/providers/local/draft';
import { clearDerived } from './retract';
import { applyExtraction, loadKnownEntities, type ExtractionReport } from './extract';
import { harvestDialogueLines, recomputeVoiceProfiles } from '../voice/profile';
import { indexCanonVersion } from '../memory/index-canon';
import { extractKeywords } from '../ai/providers/local/summarize';
import { contentHash } from '../memory/hash';
import { recordUsage } from '../ai/usage';
import { log } from '../log';

export type ApprovalReport = { chapterId: string; versionId: string; extractionStatus: 'done' | 'failed'; extraction: ExtractionReport | null; error?: string; retractedFrom?: string };

export async function approveVersion(ctx: AppContext, userId: string, versionId: string): Promise<ApprovalReport> {
  const { version, chapter } = await getVersionForUser(ctx.db, userId, versionId);
  if (!version.content.trim()) throw new ValidationError('Cannot approve an empty chapter.');
  if (version.content.includes(LOCAL_DRAFT_LABEL)) throw new ValidationError('This is an unedited local scaffold. Write or edit the chapter (and remove the label line) before approving it as canon.');
  if (chapter.approvedVersionId === version.id) throw new ConflictError('This version is already the approved canon.');
  const prev = chapter.approvedVersionId;
  if (prev) {
    const open = await ctx.db.select({ id: s.memoryConflicts.id }).from(s.memoryConflicts).where(and(eq(s.memoryConflicts.chapterVersionId, prev), eq(s.memoryConflicts.status, 'open')));
    if (open.length) throw new ConflictError(`Resolve the ${open.length} open memory conflict(s) from this chapter's current approval first.`);
  }
  await ctx.db.transaction(async (tx) => {
    if (prev) {
      await clearDerived(tx, prev, { revertStates: true, conflictForEdited: true, chapterNumber: chapter.number, novelId: chapter.novelId });
      await tx.update(s.chapterVersions).set({ isCanon: false }).where(eq(s.chapterVersions.id, prev));
    }
    await tx.update(s.chapterVersions).set({ isCanon: true }).where(eq(s.chapterVersions.id, version.id));
    await tx.update(s.chapters).set({ approvedVersionId: version.id, currentVersionId: version.id, status: 'approved', extractionStatus: 'pending', extractionError: null }).where(eq(s.chapters.id, chapter.id));
  });
  const report = await runCanonPipeline(ctx, userId, { ...chapter, approvedVersionId: version.id }, { ...version, isCanon: true });
  return { ...report, retractedFrom: prev ?? undefined };
}

export async function retryExtraction(ctx: AppContext, userId: string, chapterId: string): Promise<ApprovalReport> {
  const chapter = await getChapterForUser(ctx.db, userId, chapterId);
  if (!chapter.approvedVersionId) throw new ConflictError('This chapter has no approved version.');
  const { version } = await getVersionForUser(ctx.db, userId, chapter.approvedVersionId);
  return runCanonPipeline(ctx, userId, chapter, version);
}

async function runCanonPipeline(ctx: AppContext, userId: string, chapter: Chapter, version: ChapterVersion): Promise<ApprovalReport> {
  const { db } = ctx; const novelId = chapter.novelId;
  try {
    await db.transaction((tx) => clearDerived(tx, version.id, { revertStates: true, conflictForEdited: false, chapterNumber: chapter.number, novelId }));
    const sum = await ctx.ai.summarize(version.content, { maxWords: 150 });
    await recordUsage(db, { userId, novelId, operation: 'summarize' }, sum);
    const known = await loadKnownEntities(db, novelId);
    const ex = await ctx.ai.extractMemory({ text: version.content, chapterNumber: chapter.number, known });
    await recordUsage(db, { userId, novelId, operation: 'extract' }, ex);
    const [{ latest }] = await db.select({ latest: max(s.chapters.number) }).from(s.chapters).where(and(eq(s.chapters.novelId, novelId), isNotNull(s.chapters.approvedVersionId)));
    const extraction = await db.transaction((tx) => applyExtraction(tx, { novelId, versionId: version.id, chapterNumber: chapter.number, latestCanonNumber: latest ?? chapter.number }, ex.value));
    await db.insert(s.chapterSummaries).values({ chapterVersionId: version.id, novelId, summary: sum.value, keyEvents: ex.value.events.map((e) => e.description).slice(0, 8), keywords: extractKeywords(version.content, 15), contentHash: contentHash(version.content) });
    await harvestDialogueLines(db, { novelId, versionId: version.id, chapterNumber: chapter.number, content: version.content });
    await recomputeVoiceProfiles(db, novelId);
    const idx = await indexCanonVersion(ctx, { novelId, chapterId: chapter.id, chapterNumber: chapter.number, versionId: version.id, content: version.content });
    await recordUsage(db, { userId, novelId, operation: 'embed' }, { value: null, usage: idx.usage, provider: ctx.embedder.id, model: ctx.embedder.model });
    await db.update(s.chapters).set({ extractionStatus: 'done', extractionError: null }).where(eq(s.chapters.id, chapter.id));
    return { chapterId: chapter.id, versionId: version.id, extractionStatus: 'done', extraction };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error('canon pipeline failed', { chapterId: chapter.id, err: msg });
    await db.update(s.chapters).set({ extractionStatus: 'failed', extractionError: msg.slice(0, 500) }).where(eq(s.chapters.id, chapter.id));
    return { chapterId: chapter.id, versionId: version.id, extractionStatus: 'failed', extraction: null, error: 'The chapter is canon, but memory extraction failed. Retry from the chapter page.' };
  }
}
