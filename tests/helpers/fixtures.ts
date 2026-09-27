import { randomUUID } from 'node:crypto';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { createNovel } from '@/server/services/novels';

export async function makeUser(db: DB, email = `u-${randomUUID()}@test.io`) {
  const [u] = await db.insert(s.users).values({ email, passwordHash: 'x' }).returning();
  return u;
}
export async function makeNovel(db: DB, userId: string, overrides: Partial<Parameters<typeof createNovel>[2]> = {}) {
  return createNovel(db, userId, { title: 'The Ashen Crown', genre: 'Fantasy', premise: 'A thief inherits a cursed crown.', ...overrides });
}
