import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, fillerChapterText, CH2_KEY_TEXT } from '../helpers/fixtures';
import { createChapter } from '@/server/services/chapters';
import { autosaveVersion } from '@/server/services/versions';
import { generateDraft } from '@/server/pipeline/generate';
import { submitFeedback, updateProposalItems, applyProposal, ratingHistory } from '@/server/feedback/service';
import { approveVersion } from '@/server/canon/approve';
import { buildContextPack } from '@/server/memory/retrieve';
import { getVoiceProfile } from '@/server/voice/profile';
import { listPreferences } from '@/server/feedback/preferences';
import { getMemoryOverview } from '@/server/canon/memory';
import * as s from '@/server/db/schema';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
const empty = { whatWorked: '', whatDidnt: '', changesRequested: '', charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' };
const prose = (n: number) => n === 2 ? CH2_KEY_TEXT : n === 1
  ? ['Mira Vale cut the purse strings on the Salt Road and ran.', '“Figures,” Mira said. “Nobody guards the good stuff.”', '“I do not approve of theft,” Bram said. “It is beneath us.”', 'Mira distrusts Bram. She did not say so.'].join('\n\n')
  : fillerChapterText(n);

describe('a 25-chapter novel through the full loop', () => {
  let userId = ''; let novelId = ''; let w: Awaited<ReturnType<typeof setupAshenCrown>>;
  beforeAll(async () => {
    ctx = await createTestContext();
    userId = (await makeUser(ctx.db)).id;
    w = await setupAshenCrown(ctx, userId); novelId = w.novel.id;
    for (let n = 1; n <= 24; n++) {
      const ch = await createChapter(ctx.db, userId, novelId, { number: n, title: `Chapter ${n}`, mainIdea: n === 2 ? 'Mira hides the key' : `Day ${n}`, requiredEvents: [n === 2 ? 'Mira hides the Starlight Key' : `Day ${n} passes`], characterIds: [n <= 2 ? w.mira.id : w.cass.id] });
      const { version: gen } = await generateDraft(ctx, userId, ch.id);
      const fb = await submitFeedback(ctx, userId, { versionId: gen.id, rating: 5 + (n % 5), answers: { ...empty, dialogueNatural: n % 3 === 0 ? 'The dialogue is too formal.' : '', remove: 'Chapter focus' } });
      await updateProposalItems(ctx.db, userId, fb.proposal.id, fb.proposal.items.map((i) => ({ id: i.id, status: 'accepted' as const })));
      const revised = await applyProposal(ctx, userId, fb.proposal.id);
      const { version: final } = await autosaveVersion(ctx.db, userId, revised.id, prose(n));
      const r = await approveVersion(ctx, userId, final.id);
      expect(r.extractionStatus).toBe('done');
    }
  }, 600_000);

  it('retrieves a chapter-2 fact when writing chapter 25', async () => {
    const ch = await createChapter(ctx.db, userId, novelId, { number: 25, mainIdea: 'Mira returns to recover what she hid', requiredEvents: ['Mira retrieves the Starlight Key'], characterIds: [w.mira.id] });
    const pack = await buildContextPack(ctx, ch);
    expect(pack.retrieved.some((r) => r.chapterNumber === 2 && r.content.includes('Starlight Key'))).toBe(true);
    expect(pack.budget.used).toBeLessThanOrEqual(pack.budget.limit);
    expect(pack.recentChapters.map((c) => c.number)).toEqual([24, 23]);
    const { version } = await generateDraft(ctx, userId, ch.id);
    expect(version.content).toContain('Canon reminder, chapter 2');
  });
  it('keeps context size flat as the novel grows', async () => {
    const early = await createChapter(ctx.db, userId, novelId, { number: 100, mainIdea: 'Cass waits at the Salt Road', characterIds: [w.cass.id] });
    const small = await buildContextPack(ctx, { ...early, number: 4 });
    const large = await buildContextPack(ctx, early);
    expect(large.budget.used).toBeLessThanOrEqual(large.budget.limit);
    expect(large.budget.used).toBeLessThan(small.budget.used * 3);
  });
  it('built memory from approved canon only', async () => {
    const o = await getMemoryOverview(ctx.db, userId, novelId);
    expect(o.counts.canonChapters).toBe(24);
    const tl = await ctx.db.select().from(s.timelineEvents).where(and(eq(s.timelineEvents.novelId, novelId), eq(s.timelineEvents.chapterNumber, 2)));
    expect(tl.some((e) => e.description.includes('Starlight Key'))).toBe(true);
    const drafts = await ctx.db.select().from(s.memoryChunks).innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.memoryChunks.chapterVersionId)).where(eq(s.chapterVersions.isCanon, false));
    expect(drafts).toHaveLength(0);
  });
  it('learned distinct voices and promoted a repeated global preference', async () => {
    const mira = await getVoiceProfile(ctx.db, userId, w.mira.id);
    const bram = await getVoiceProfile(ctx.db, userId, w.bram.id);
    expect(mira.register).not.toBe(bram.register);
    const prefs = await listPreferences(ctx.db, userId, novelId);
    expect(prefs.global.find((p) => p.themeKey === 'dialogue.too_formal')?.status).toBe('active');
    expect(prefs.chapterNotes.length).toBe(0); // "Chapter focus" removals are items, not themes
  });
  it('stored every rating and kept every version', async () => {
    const h = await ratingHistory(ctx.db, userId, novelId);
    expect(h.slice(0, 24).every((c) => c.versions.length === 1)).toBe(true);
    const versions = await ctx.db.select().from(s.chapterVersions).where(eq(s.chapterVersions.novelId, novelId));
    expect(versions.length).toBeGreaterThanOrEqual(24 * 3);
  });
  it('never leaks another user’s canon into retrieval', async () => {
    const other = await makeUser(ctx.db); const ow = await setupAshenCrown(ctx, other.id);
    const ch = await createChapter(ctx.db, other.id, ow.novel.id, { number: 5, mainIdea: 'Mira retrieves the Starlight Key' });
    expect((await buildContextPack(ctx, ch)).retrieved).toHaveLength(0);
  });
});
