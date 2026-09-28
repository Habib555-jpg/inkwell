import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { approveVersion, retryExtraction } from '@/server/canon/approve';
import { createChapter, getChapterDetail } from '@/server/services/chapters';
import { saveManualVersion, autosaveVersion } from '@/server/services/versions';
import { updateCharacter } from '@/server/services/characters';
import { getVoiceProfile } from '@/server/voice/profile';
import { LOCAL_DRAFT_LABEL } from '@/server/ai/providers/local/draft';
import * as s from '@/server/db/schema';
import { ConflictError, NotFoundError, ValidationError, AIError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

const CH = (extra = '') => [
  'Mira arrived at Vey Harbor before dawn.',
  '“You’re late,” Tovin Rask said. Tovin Rask was a broker for the Grey Guild.',
  '“Figures,” Mira said. “Nobody pays on time.”',
  extra,
].filter(Boolean).join('\n\n');

async function setup(text = CH()) {
  const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
  const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'Arrival' });
  const v = await saveManualVersion(ctx.db, u.id, ch.id, text);
  return { u, w, ch, v };
}
const count = async (t: typeof s.memoryChunks | typeof s.chapterSummaries, versionId: string) =>
  (await ctx.db.select().from(t).where(eq(t.chapterVersionId, versionId))).length;

describe('approveVersion', () => {
  it('makes the version canon and updates every memory layer', async () => {
    const { u, w, ch, v } = await setup();
    const r = await approveVersion(ctx, u.id, v.id);
    expect(r.extractionStatus).toBe('done');
    const { chapter } = await getChapterDetail(ctx.db, u.id, ch.id);
    expect([chapter.status, chapter.approvedVersionId, chapter.extractionStatus]).toEqual(['approved', v.id, 'done']);
    expect(await count(s.chapterSummaries, v.id)).toBe(1);
    expect(await count(s.memoryChunks, v.id)).toBeGreaterThan(0);
    expect((await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)))).length).toBe(1);
    expect((await ctx.db.select().from(s.timelineEvents).where(eq(s.timelineEvents.sourceChapterVersionId, v.id))).length).toBeGreaterThan(0);
    const mira = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(mira.lineCount).toBeGreaterThan(0);
  });
  it('rejects empty content', async () => {
    const { u, ch, v } = await setup('   \n  ');
    await expect(approveVersion(ctx, u.id, v.id)).rejects.toBeInstanceOf(ValidationError);
    expect((await getChapterDetail(ctx.db, u.id, ch.id)).chapter.approvedVersionId).toBeNull();
  });
  it('rejects an unedited local scaffold', async () => {
    const { u, v } = await setup(`${LOCAL_DRAFT_LABEL}\n\nChapter 1`);
    await expect(approveVersion(ctx, u.id, v.id)).rejects.toBeInstanceOf(ValidationError);
  });
  it('rejects re-approving the same version and other users', async () => {
    const { u, v } = await setup(); const o = await makeUser(ctx.db);
    await expect(approveVersion(ctx, o.id, v.id)).rejects.toBeInstanceOf(NotFoundError);
    await approveVersion(ctx, u.id, v.id);
    await expect(approveVersion(ctx, u.id, v.id)).rejects.toBeInstanceOf(ConflictError);
  });
  it('editing canon marks canon_changed but memory keeps the approved version until re-approval', async () => {
    const { u, w, ch, v } = await setup();
    await approveVersion(ctx, u.id, v.id);
    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v.id, 'Mira arrived at Vey Harbor before dawn. Nobody else came.');
    expect((await getChapterDetail(ctx.db, u.id, ch.id)).chapter.status).toBe('canon_changed');
    expect((await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)))).length).toBe(1);
    const r = await approveVersion(ctx, u.id, v2.id);
    expect(r.retractedFrom).toBe(v.id);
    expect((await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)))).length).toBe(0);
    expect(await count(s.memoryChunks, v.id)).toBe(0);
    const [old] = await ctx.db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, v.id));
    expect(old.isCanon).toBe(false);
    const canon = await ctx.db.select().from(s.chapterVersions).where(and(eq(s.chapterVersions.chapterId, ch.id), eq(s.chapterVersions.isCanon, true)));
    expect(canon.map((x) => x.id)).toEqual([v2.id]);
  });
  it('user-edited records from a retracted version become conflicts, not deletions', async () => {
    const { u, w, v } = await setup();
    await approveVersion(ctx, u.id, v.id);
    const [tovin] = await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)));
    await updateCharacter(ctx.db, u.id, tovin.id, { personality: 'oily, precise' });
    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v.id, 'Mira waited alone at Vey Harbor.');
    await approveVersion(ctx, u.id, v2.id);
    expect((await ctx.db.select().from(s.characters).where(eq(s.characters.id, tovin.id))).length).toBe(1);
    const [c] = await ctx.db.select().from(s.memoryConflicts).where(eq(s.memoryConflicts.entityId, tovin.id));
    expect(c.kind).toBe('retracted_record');
  });
  it('blocks re-approval while conflicts from the current approval are open', async () => {
    const { u, v, w } = await setup(CH('Bram was killed at the pier.'));
    await updateCharacter(ctx.db, u.id, w.bram.id, { currentStatus: 'alive' });
    await approveVersion(ctx, u.id, v.id); // opens a currentStatus conflict
    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v.id, CH());
    await expect(approveVersion(ctx, u.id, v2.id)).rejects.toBeInstanceOf(ConflictError);
  });
  it('extraction failure keeps canon; retry completes it', async () => {
    const { u, ch, v } = await setup();
    const broken: AppContext = { ...ctx, ai: { ...ctx.ai, id: ctx.ai.id, model: ctx.ai.model.bind(ctx.ai), generateText: ctx.ai.generateText.bind(ctx.ai), analyzeText: ctx.ai.analyzeText.bind(ctx.ai), summarize: ctx.ai.summarize.bind(ctx.ai), extractMemory: async () => { throw new AIError('provider down'); } } };
    const r = await approveVersion(broken, u.id, v.id);
    expect(r.extractionStatus).toBe('failed');
    let { chapter } = await getChapterDetail(ctx.db, u.id, ch.id);
    expect([chapter.approvedVersionId, chapter.extractionStatus]).toEqual([v.id, 'failed']);
    const ok = await retryExtraction(ctx, u.id, ch.id);
    expect(ok.extractionStatus).toBe('done');
    ({ chapter } = await getChapterDetail(ctx.db, u.id, ch.id));
    expect(chapter.extractionStatus).toBe('done');
    expect(await count(s.chapterSummaries, v.id)).toBe(1); // idempotent: no duplicate summary
  });
});
