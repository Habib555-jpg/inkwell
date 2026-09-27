import { describe, it, expect, beforeAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('database', () => {
  it('migrates and round-trips a user', async () => {
    const [u] = await db.insert(s.users).values({ email: 'a@x.io', passwordHash: 'h' }).returning();
    const [back] = await db.select().from(s.users).where(eq(s.users.id, u.id));
    expect(back.email).toBe('a@x.io');
  });
  it('stores vectors and ranks by cosine similarity', async () => {
    const [u] = await db.insert(s.users).values({ email: 'v@x.io', passwordHash: 'h' }).returning();
    const [n] = await db.insert(s.novels).values({ ownerId: u.id, title: 'N' }).returning();
    const [c] = await db.insert(s.chapters).values({ novelId: n.id, number: 1 }).returning();
    const [v] = await db.insert(s.chapterVersions).values({ chapterId: c.id, novelId: n.id, versionNumber: 1, content: 'x', source: 'manual' }).returning();
    await db.insert(s.memoryChunks).values([
      { novelId: n.id, chapterId: c.id, chapterVersionId: v.id, chapterNumber: 1, chunkIndex: 0, content: 'a', contentHash: 'a', embedding: [1, 0, 0], embeddingModel: 'm' },
      { novelId: n.id, chapterId: c.id, chapterVersionId: v.id, chapterNumber: 1, chunkIndex: 1, content: 'b', contentHash: 'b', embedding: [0, 1, 0], embeddingModel: 'm' },
    ]);
    const q = s.toVectorLiteral([0.9, 0.1, 0]);
    const rows = await db.select({ content: s.memoryChunks.content, score: sql<number>`1 - (${s.memoryChunks.embedding} <=> ${q}::vector)` })
      .from(s.memoryChunks).orderBy(sql`${s.memoryChunks.embedding} <=> ${q}::vector`);
    expect(rows.map((r) => r.content)).toEqual(['a', 'b']);
    expect(rows[0].score).toBeGreaterThan(0.9);
  });
  it('enforces the rating check constraint', async () => {
    await expect(db.execute(sql`insert into chapter_feedback (novel_id, chapter_id, chapter_version_id, rating) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 11)`)).rejects.toThrow();
  });
});
