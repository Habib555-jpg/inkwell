import { and, eq, inArray } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { EmbeddingProvider, TokenUsage } from '../ai/types';
import { contentHash } from './hash';

export async function embedWithCache(db: DB, embedder: EmbeddingProvider, texts: string[]) {
  const hashes = texts.map(contentHash);
  const uniq = [...new Set(hashes)];
  const hits = uniq.length ? await db.select().from(s.embeddingCache)
    .where(and(eq(s.embeddingCache.model, embedder.model), inArray(s.embeddingCache.contentHash, uniq))) : [];
  const byHash = new Map(hits.map((h) => [h.contentHash, h.embedding]));
  const missing = uniq.filter((h) => !byHash.has(h));
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, estimated: true };
  if (missing.length) {
    const missTexts = missing.map((h) => texts[hashes.indexOf(h)]);
    const r = await embedder.embed(missTexts);
    usage = r.usage;
    const rows = missing.map((h, i) => ({ contentHash: h, model: embedder.model, embedding: r.value[i] }));
    await db.insert(s.embeddingCache).values(rows).onConflictDoNothing();
    rows.forEach((row) => byHash.set(row.contentHash, row.embedding));
  }
  return { vectors: hashes.map((h) => byHash.get(h)!), usage, cached: texts.length - missing.length };
}
