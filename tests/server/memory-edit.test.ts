import { describe, it, expect, beforeAll } from 'vitest';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { createChapter } from '@/server/services/chapters';
import { saveManualVersion } from '@/server/services/versions';
import { approveVersion } from '@/server/canon/approve';
import { getMemoryOverview, updateSummary, deleteChunk, listChunks, deleteFact } from '@/server/canon/memory';
import { buildContextPack } from '@/server/memory/retrieve';
import { NotFoundError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

describe('memory inspection & editing', () => {
  it('summarizes every layer and lets the user correct it', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'x' });
    const v = await saveManualVersion(ctx.db, u.id, ch.id, 'Mira hid the Starlight Key beneath the old lighthouse. Mira distrusts Bram.');
    await approveVersion(ctx, u.id, v.id);
    const o = await getMemoryOverview(ctx.db, u.id, w.novel.id);
    expect(o.counts.canonChapters).toBe(1);
    expect(o.counts.chunks).toBeGreaterThan(0);
    expect(o.canonChapters[0].summary.length).toBeGreaterThan(0);
    const summaryId = o.canonChapters[0].summaryId!;
    await updateSummary(ctx.db, u.id, summaryId, 'Mira hides the Starlight Key at the lighthouse.');
    expect((await getMemoryOverview(ctx.db, u.id, w.novel.id)).canonChapters[0].summary).toBe('Mira hides the Starlight Key at the lighthouse.');
    const chunks = await listChunks(ctx.db, u.id, w.novel.id, {});
    for (const c of chunks) await deleteChunk(ctx.db, u.id, c.id);
    const next = await createChapter(ctx.db, u.id, w.novel.id, { number: 3, mainIdea: 'Mira retrieves the Starlight Key' });
    expect((await buildContextPack(ctx, next)).retrieved).toHaveLength(0);
    if (o.facts[0]) await deleteFact(ctx.db, u.id, o.facts[0].id);
  });
  it('isolates users', async () => {
    const u = await makeUser(ctx.db); const o = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await expect(getMemoryOverview(ctx.db, o.id, w.novel.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
