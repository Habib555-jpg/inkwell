import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext } from '../helpers/db';
import { makeUser, seedCanonChapter, fillerChapterText, setupAshenCrown, CH2_KEY_TEXT } from '../helpers/fixtures';
import { buildContextPack } from '@/server/memory/retrieve';
import { fitToBudget } from '@/server/memory/budget';
import { createChapter } from '@/server/services/chapters';
import * as s from '@/server/db/schema';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
let world: Awaited<ReturnType<typeof setupAshenCrown>>;
let userId: string;
beforeAll(async () => {
  ctx = await createTestContext();
  userId = (await makeUser(ctx.db)).id;
  world = await setupAshenCrown(ctx, userId);
  await seedCanonChapter(ctx, userId, world.novel.id, { number: 1, content: 'Mira stole the ledger from the Salt Road customs house. Bram Holt watched and said nothing.' });
  await seedCanonChapter(ctx, userId, world.novel.id, { number: 2, content: CH2_KEY_TEXT });
  for (let i = 3; i <= 24; i++) await seedCanonChapter(ctx, userId, world.novel.id, { number: i, content: fillerChapterText(i) });
}, 180_000);

describe('buildContextPack', () => {
  it('retrieves an early-chapter fact for chapter 25 after many later chapters', async () => {
    const ch = await createChapter(ctx.db, userId, world.novel.id, { number: 25, mainIdea: 'Mira returns for the hidden key', requiredEvents: ['Mira retrieves the Starlight Key'], characterIds: [world.mira.id] });
    const pack = await buildContextPack(ctx, ch);
    const hit = pack.retrieved.find((r) => r.content.includes('Starlight Key'));
    expect(hit?.chapterNumber).toBe(2);
    expect(pack.recentChapters.map((c) => c.number)).toEqual([24, 23]);
    expect(pack.recentChapters[0].tail).toBeTruthy();
    expect(pack.budget.used).toBeLessThanOrEqual(pack.budget.limit);
    expect(pack.world.some((w) => w.name === "Gull's Rest")).toBe(true);
  });
  it('excludes chapters at or after N', async () => {
    const base = await createChapter(ctx.db, userId, world.novel.id, { number: 40, mainIdea: 'Mira and the Starlight Key' });
    const pack = await buildContextPack(ctx, { ...base, number: 2 }); // evaluate as if writing chapter 2
    expect(pack.retrieved.every((r) => r.chapterNumber < 2)).toBe(true);
    expect(pack.recentChapters.map((c) => c.number)).toEqual([1]);
    expect(pack.retrieved.some((r) => r.content.includes('Starlight Key'))).toBe(false);
  });
  it('includes involved characters with voice cards and only their relationships', async () => {
    const ch = await createChapter(ctx.db, userId, world.novel.id, { number: 28, mainIdea: 'Mira confronts Bram', characterIds: [world.mira.id] });
    const pack = await buildContextPack(ctx, ch);
    expect(pack.characters.map((c) => c.name).sort()).toEqual(['Bram Holt', 'Mira Vale']); // Bram via name mention
    expect(pack.characters[0].voice).toBeDefined();
    expect(pack.relationships.some((r) => r.type === 'distrusts')).toBe(true);
    expect(pack.relationships.some((r) => r.type === 'owes a debt to')).toBe(true); // Cass→Bram: one end involved
  });
  it('ignores chunks embedded with a different model', async () => {
    await ctx.db.update(s.memoryChunks).set({ embeddingModel: 'other' });
    const ch = await createChapter(ctx.db, userId, world.novel.id, { number: 29, mainIdea: 'Mira retrieves the Starlight Key' });
    expect((await buildContextPack(ctx, ch)).retrieved).toHaveLength(0);
    await ctx.db.update(s.memoryChunks).set({ embeddingModel: 'local-hash-384' });
  });
  it('includes only active preferences', async () => {
    await ctx.db.insert(s.writingPreferences).values([
      { novelId: world.novel.id, scope: 'global', statement: 'Keep dialogue informal.', status: 'active' },
      { novelId: world.novel.id, scope: 'global', statement: 'Candidate only.', status: 'candidate' },
    ]);
    const ch = await createChapter(ctx.db, userId, world.novel.id, { number: 31, mainIdea: 'x' });
    const prefs = (await buildContextPack(ctx, ch)).preferences.map((p) => p.statement);
    expect(prefs).toContain('Keep dialogue informal.');
    expect(prefs).not.toContain('Candidate only.');
  });
});

describe('fitToBudget', () => {
  it('keeps required items and highest priority within the limit', () => {
    const r = fitToBudget([
      { key: 'req', tokens: 50, priority: 0, required: true },
      { key: 'a', tokens: 40, priority: 9 }, { key: 'b', tokens: 40, priority: 5 }, { key: 'c', tokens: 40, priority: 7 },
    ], 140);
    expect([...r.keep].sort()).toEqual(['a', 'c', 'req']);
    expect(r.trimmed).toEqual(['b']);
    expect(r.used).toBe(130);
  });
});
