import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter, fillerChapterText, CH2_KEY_TEXT } from '../helpers/fixtures';
import { buildContextPack } from '@/server/memory/retrieve';
import { describeIncluded } from '@/server/memory/describe';
import { createChapter } from '@/server/services/chapters';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

describe('describeIncluded', () => {
  it('turns pack ids into readable labels', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await seedCanonChapter(ctx, u.id, w.novel.id, { number: 2, content: CH2_KEY_TEXT });
    await seedCanonChapter(ctx, u.id, w.novel.id, { number: 3, content: fillerChapterText(3) }); // ch2 reaches the pack via semantic retrieval
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 4, mainIdea: 'Mira retrieves the Starlight Key', characterIds: [w.mira.id] });
    const pack = await buildContextPack(ctx, ch);
    const labels = await describeIncluded(ctx.db, w.novel.id, pack.included);
    expect(labels.some((l) => l.section === 'voice' && l.label === 'Mira Vale')).toBe(true);
    expect(labels.some((l) => l.section === 'chunk' && l.label.startsWith('Chapter 2'))).toBe(true);
    expect(labels.some((l) => l.section === 'profile')).toBe(true);
  });
});
