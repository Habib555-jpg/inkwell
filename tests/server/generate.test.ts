import { describe, it, expect, beforeAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter, fillerChapterText, CH2_KEY_TEXT } from '../helpers/fixtures';
import { generateDraft } from '@/server/pipeline/generate';
import { createChapter } from '@/server/services/chapters';
import { LOCAL_DRAFT_LABEL } from '@/server/ai/providers/local/draft';
import * as s from '@/server/db/schema';
import { NotFoundError, RateLimitError, ValidationError } from '@/server/errors';
import { getEnv } from '@/server/env';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

describe('generateDraft', () => {
  it('creates a generated version with memory metadata and records usage', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await seedCanonChapter(ctx, u.id, w.novel.id, { number: 2, content: CH2_KEY_TEXT });
    await seedCanonChapter(ctx, u.id, w.novel.id, { number: 3, content: fillerChapterText(3) }); // ch2 must come via semantic retrieval, not "previous chapter"
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 4, mainIdea: 'Mira returns', requiredEvents: ['Mira retrieves the Starlight Key'], characterIds: [w.mira.id] });
    const { version, pack } = await generateDraft(ctx, u.id, ch.id);
    expect(version.source).toBe('generated');
    expect(version.content.startsWith(LOCAL_DRAFT_LABEL)).toBe(true);
    expect((version.generationMeta as { included: unknown[] }).included.length).toBeGreaterThan(0);
    expect(pack.retrieved.some((r) => r.chapterNumber === 2)).toBe(true);
    const usage = await ctx.db.select().from(s.aiUsage).where(eq(s.aiUsage.userId, u.id));
    expect(usage.map((x) => x.operation)).toContain('generate');
  });
  it('never modifies the story bible', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const count = async () => (await ctx.db.execute(sql`select (select count(*) from characters where novel_id=${w.novel.id}) + (select count(*) from timeline_events where novel_id=${w.novel.id}) + (select count(*) from character_relationships where novel_id=${w.novel.id}) as n`) as unknown as { rows: { n: number }[] }).rows[0].n;
    const before = await count();
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'A new stranger named Tovin arrives', requiredEvents: ['Tovin arrives'] });
    await generateDraft(ctx, u.id, ch.id);
    expect(await count()).toBe(before);
  });
  it('requires a main idea or required events', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, {});
    await expect(generateDraft(ctx, u.id, ch.id)).rejects.toBeInstanceOf(ValidationError);
  });
  it('rejects other users', async () => {
    const u = await makeUser(ctx.db); const o = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'x' });
    await expect(generateDraft(ctx, o.id, ch.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('is rate limited per user', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'x' });
    await ctx.db.insert(s.rateLimits).values({ key: `ai:${u.id}`, windowStart: new Date(), count: getEnv().AI_RATE_LIMIT_PER_MIN });
    await expect(generateDraft(ctx, u.id, ch.id)).rejects.toBeInstanceOf(RateLimitError);
  });
});
