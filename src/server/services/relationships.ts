import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from './access';
import { parse, shortText, longText } from '../validation';
import { ValidationError } from '../errors';

export const relationshipInputSchema = z.object({
  fromCharacterId: z.string().uuid(),
  toCharacterId: z.string().uuid(),
  type: shortText.min(1),
  description: longText.optional(),
  isSecret: z.boolean().optional(),
  sinceChapterNumber: z.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

async function assertPairInNovel(db: DB, novelId: string, ids: string[]) {
  const rows = await db.select({ id: s.characters.id }).from(s.characters)
    .where(and(eq(s.characters.novelId, novelId), inArray(s.characters.id, ids)));
  if (new Set(rows.map((r) => r.id)).size !== new Set(ids).size) throw new ValidationError('Both characters must belong to this novel');
}

export async function createRelationship(db: DB, userId: string, novelId: string, input: z.input<typeof relationshipInputSchema>) {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(relationshipInputSchema, input);
  if (data.fromCharacterId === data.toCharacterId) throw new ValidationError('A relationship needs two different characters');
  await assertPairInNovel(db, novelId, [data.fromCharacterId, data.toCharacterId]);
  const [r] = await db.insert(s.characterRelationships).values({ ...data, novelId }).returning();
  return r;
}
export async function listRelationships(db: DB, userId: string, novelId: string, opts: { includeInactive?: boolean } = {}) {
  await assertNovelOwner(db, userId, novelId);
  const where = opts.includeInactive
    ? eq(s.characterRelationships.novelId, novelId)
    : and(eq(s.characterRelationships.novelId, novelId), eq(s.characterRelationships.active, true));
  return db.select().from(s.characterRelationships).where(where);
}
export async function updateRelationship(db: DB, userId: string, id: string, patch: Partial<z.input<typeof relationshipInputSchema>>) {
  const novelId = await assertRowInNovel(db, userId, s.characterRelationships, id, 'Relationship');
  const data = parse(relationshipInputSchema.partial(), patch);
  const ids = [data.fromCharacterId, data.toCharacterId].filter(Boolean) as string[];
  if (ids.length) await assertPairInNovel(db, novelId, ids);
  const [r] = await db.update(s.characterRelationships).set({ ...data, userEdited: true }).where(eq(s.characterRelationships.id, id)).returning();
  return r;
}
export async function deleteRelationship(db: DB, userId: string, id: string) {
  await assertRowInNovel(db, userId, s.characterRelationships, id, 'Relationship');
  await db.delete(s.characterRelationships).where(eq(s.characterRelationships.id, id));
}
