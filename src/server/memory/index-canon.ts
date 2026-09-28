import { and, eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { EmbeddingProvider } from '../ai/types';
import { chunkText } from './chunker';
import { embedWithCache } from './embed';
import { contentHash } from './hash';
import { extractKeywords } from '../ai/providers/local/summarize';
import { assertNovelOwner } from '../services/access';

type Ctx = { db: DB; embedder: EmbeddingProvider };
export async function removeVersionIndex(db: DB, versionId: string) {
  await db.delete(s.memoryChunks).where(eq(s.memoryChunks.chapterVersionId, versionId));
}
export async function indexCanonVersion(ctx: Ctx, v: { novelId: string; chapterId: string; chapterNumber: number; versionId: string; content: string }) {
  const chunks = chunkText(v.content);
  const { vectors, usage } = await embedWithCache(ctx.db, ctx.embedder, chunks);
  await ctx.db.transaction(async (tx) => {
    await tx.delete(s.memoryChunks).where(eq(s.memoryChunks.chapterVersionId, v.versionId));
    if (chunks.length) await tx.insert(s.memoryChunks).values(chunks.map((content, i) => ({
      novelId: v.novelId, chapterId: v.chapterId, chapterVersionId: v.versionId, chapterNumber: v.chapterNumber, chunkIndex: i,
      content, contentHash: contentHash(content), embedding: vectors[i], embeddingModel: ctx.embedder.model, keywords: extractKeywords(content, 10),
    })));
  });
  return { chunks: chunks.length, usage };
}
export async function reembedNovel(ctx: Ctx, userId: string, novelId: string) {
  await assertNovelOwner(ctx.db, userId, novelId);
  const canon = await ctx.db.select({ v: s.chapterVersions, c: s.chapters }).from(s.chapters)
    .innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.chapters.approvedVersionId))
    .where(and(eq(s.chapters.novelId, novelId), eq(s.chapterVersions.isCanon, true)));
  let total = 0;
  for (const { v, c } of canon) total += (await indexCanonVersion(ctx, { novelId, chapterId: c.id, chapterNumber: c.number, versionId: v.id, content: v.content })).chunks;
  return { chunks: total };
}
