import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from './access';
import { parse, shortText, longText } from '../validation';

export const characterInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  aliases: z.array(shortText.min(1)).max(20).optional(),
  role: shortText.optional(), age: shortText.optional(),
  appearance: longText.optional(), personality: longText.optional(), goals: longText.optional(),
  fears: longText.optional(), motivations: longText.optional(), abilities: longText.optional(),
  weaknesses: longText.optional(), speechStyle: longText.optional(), vocabulary: longText.optional(),
  developmentNotes: longText.optional(), currentStatus: shortText.optional(),
  currentLocationId: z.string().uuid().nullable().optional(),
});
export type CharacterInput = z.infer<typeof characterInputSchema>;
export type Character = typeof s.characters.$inferSelect;

export async function createCharacter(db: DB, userId: string, novelId: string, input: CharacterInput) {
  await assertNovelOwner(db, userId, novelId);
  const data = parse(characterInputSchema, input);
  const [c] = await db.insert(s.characters).values({ ...data, novelId }).returning();
  return c;
}
export async function listCharacters(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  return db.select().from(s.characters).where(eq(s.characters.novelId, novelId)).orderBy(asc(s.characters.name));
}
export async function getCharacter(db: DB, userId: string, id: string) {
  await assertRowInNovel(db, userId, s.characters, id, 'Character');
  const [c] = await db.select().from(s.characters).where(eq(s.characters.id, id));
  return c;
}
export async function updateCharacter(db: DB, userId: string, id: string, patch: Partial<CharacterInput>) {
  await assertRowInNovel(db, userId, s.characters, id, 'Character');
  const data = parse(characterInputSchema.partial(), patch);
  const [c] = await db.update(s.characters).set({ ...data, userEdited: true }).where(eq(s.characters.id, id)).returning();
  return c;
}
export async function deleteCharacter(db: DB, userId: string, id: string) {
  const novelId = await assertRowInNovel(db, userId, s.characters, id, 'Character');
  await db.transaction((tx) => purgeCharacterRecord(tx, id, novelId));
}

/** The one deletion path for characters: uuid[] columns have no FK, so clean them; relationships/voice/dialogue cascade via FK. */
export async function purgeCharacterRecord(db: DB, id: string, novelId: string) {
  await db.execute(sql`UPDATE timeline_events SET character_ids = array_remove(character_ids, ${id}::uuid) WHERE novel_id = ${novelId}`);
  await db.execute(sql`UPDATE chapters SET character_ids = array_remove(character_ids, ${id}::uuid) WHERE novel_id = ${novelId}`);
  await db.delete(s.characters).where(eq(s.characters.id, id));
}
