import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from './access';
import { parse, longText } from '../validation';

export type WorldKind = 'location' | 'faction' | 'world_rule' | 'story_object';
export const worldTables = {
  location: s.locations, faction: s.factions, world_rule: s.worldRules, story_object: s.storyObjects,
} as const;
const labels: Record<WorldKind, string> = { location: 'Location', faction: 'Faction', world_rule: 'World rule', story_object: 'Object' };

export const worldInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: longText.optional(),
  category: z.enum(['magic', 'technology', 'history', 'rule', 'term', 'other']).optional(),
});
export type WorldEntity = { id: string; novelId: string; name: string; description: string; category?: string; origin: 'user' | 'extracted'; userEdited: boolean; sourceChapterVersionId: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (k: WorldKind) => worldTables[k] as any;
/** Keeps only columns the kind has, and drops undefined keys so a partial patch never blanks a field. */
const clean = (k: WorldKind, d: Partial<z.infer<typeof worldInputSchema>>) =>
  Object.fromEntries(Object.entries(k === 'world_rule' ? d : { name: d.name, description: d.description }).filter(([, v]) => v !== undefined));

export async function createWorldEntity(db: DB, userId: string, novelId: string, kind: WorldKind, input: z.input<typeof worldInputSchema>): Promise<WorldEntity> {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(worldInputSchema, input);
  const rows = (await db.insert(T(kind)).values({ ...clean(kind, data), novelId }).returning()) as WorldEntity[];
  return rows[0];
}
export async function listWorldEntities(db: DB, userId: string, novelId: string, kind: WorldKind): Promise<WorldEntity[]> {
  await assertNovelOwner(db, userId, novelId);
  return db.select().from(T(kind)).where(eq(T(kind).novelId, novelId)).orderBy(asc(T(kind).name)) as unknown as Promise<WorldEntity[]>;
}
export async function updateWorldEntity(db: DB, userId: string, kind: WorldKind, id: string, patch: Partial<z.input<typeof worldInputSchema>>): Promise<WorldEntity> {
  await assertRowInNovel(db, userId, T(kind), id, labels[kind]);
  const data = parse(worldInputSchema.partial(), patch);
  const rows = (await db.update(T(kind)).set({ ...clean(kind, data), userEdited: true }).where(eq(T(kind).id, id)).returning()) as WorldEntity[];
  return rows[0];
}
export async function deleteWorldEntity(db: DB, userId: string, kind: WorldKind, id: string) {
  await assertRowInNovel(db, userId, T(kind), id, labels[kind]);
  await db.delete(T(kind)).where(eq(T(kind).id, id));
}
