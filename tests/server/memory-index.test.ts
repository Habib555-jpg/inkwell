import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, makeNovel } from '../helpers/fixtures';
import { chunkText } from '@/server/memory/chunker';
import { embedWithCache } from '@/server/memory/embed';
import { indexCanonVersion, removeVersionIndex, reembedNovel } from '@/server/memory/index-canon';
import { createChapter } from '@/server/services/chapters';
import { insertVersion } from '@/server/services/versions';
import * as s from '@/server/db/schema';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

const para = (n: number, w = 'word') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ') + '.';

describe('chunker', () => {
  it('keeps short text as one chunk', () => { expect(chunkText('One short paragraph.')).toEqual(['One short paragraph.']); });
  it('splits long text near the target with overlap', () => {
    const text = [para(200, 'a'), para(200, 'b'), para(200, 'c')].join('\n\n');
    const chunks = chunkText(text, { targetWords: 350, overlapWords: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) expect(c.split(/\s+/).length).toBeLessThanOrEqual(350 + 200 + 60);
    expect(chunks[1].startsWith(chunks[0].split(/\s+/).slice(-5)[0])).toBe(false); // overlap is sentence-aligned, not mid-word garbage
  });
  it('splits a single giant paragraph by sentences', () => {
    const text = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} has several words in it.`).join(' ');
    expect(chunkText(text, { targetWords: 100, overlapWords: 10 }).length).toBeGreaterThan(3);
  });
});

describe('embedding cache', () => {
  it('embeds each unique text once per model', async () => {
    const spy = vi.spyOn(ctx.embedder, 'embed');
    await embedWithCache(ctx.db, ctx.embedder, ['alpha beta', 'gamma delta']);
    const r = await embedWithCache(ctx.db, ctx.embedder, ['alpha beta', 'gamma delta', 'epsilon']);
    expect(r.cached).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0]).toEqual(['epsilon']);
    spy.mockRestore();
  });
});

describe('canon indexing', () => {
  it('indexes a version into chunks with vectors and keywords, idempotently', async () => {
    const u = await makeUser(ctx.db); const n = await makeNovel(ctx.db, u.id);
    const ch = await createChapter(ctx.db, u.id, n.id, { mainIdea: 'x' });
    const v = await insertVersion(ctx.db, { chapter: ch, content: 'Mira hid the Starlight Key beneath the lighthouse.', source: 'manual' });
    const args = { novelId: n.id, chapterId: ch.id, chapterNumber: 1, versionId: v.id, content: v.content };
    await indexCanonVersion(ctx, args);
    await indexCanonVersion(ctx, args);
    const rows = await ctx.db.select().from(s.memoryChunks).where(eq(s.memoryChunks.chapterVersionId, v.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].embedding).toHaveLength(384);
    expect(rows[0].embeddingModel).toBe('local-hash-384');
    expect(rows[0].keywords).toContain('Starlight Key');
    await removeVersionIndex(ctx.db, v.id);
    expect(await ctx.db.select().from(s.memoryChunks).where(eq(s.memoryChunks.chapterVersionId, v.id))).toHaveLength(0);
  });
  it('re-embeds all canon chunks for the active model', async () => {
    const u = await makeUser(ctx.db); const n = await makeNovel(ctx.db, u.id);
    const ch = await createChapter(ctx.db, u.id, n.id, { mainIdea: 'x' });
    const v = await insertVersion(ctx.db, { chapter: ch, content: 'Some canon text.', source: 'manual' });
    await ctx.db.update(s.chapterVersions).set({ isCanon: true }).where(eq(s.chapterVersions.id, v.id));
    await ctx.db.update(s.chapters).set({ approvedVersionId: v.id }).where(eq(s.chapters.id, ch.id));
    await ctx.db.insert(s.memoryChunks).values({ novelId: n.id, chapterId: ch.id, chapterVersionId: v.id, chapterNumber: 1, chunkIndex: 0, content: 'Some canon text.', contentHash: 'h', embedding: [1, 0], embeddingModel: 'old-model' });
    const r = await reembedNovel(ctx, u.id, n.id);
    expect(r.chunks).toBe(1);
    const rows = await ctx.db.select().from(s.memoryChunks).where(eq(s.memoryChunks.novelId, n.id));
    expect(rows.map((x) => x.embeddingModel)).toEqual(['local-hash-384']);
  });
});
