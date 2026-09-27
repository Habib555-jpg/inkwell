import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { makeUser, makeNovel } from '../helpers/fixtures';
import { createCharacter, listCharacters, updateCharacter, deleteCharacter, getCharacter } from '@/server/services/characters';
import { createRelationship, listRelationships } from '@/server/services/relationships';
import { createWorldEntity, listWorldEntities, updateWorldEntity } from '@/server/services/world';
import { createTimelineEvent, listTimeline } from '@/server/services/timeline';
import { createChapter } from '@/server/services/chapters';
import * as s from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/errors';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('story bible', () => {
  it('creates and lists characters with aliases; edits mark userEdited', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id);
    const c = await createCharacter(db, u.id, n.id, { name: 'Mira Vale', aliases: ['Mira'], personality: 'wry, guarded', speechStyle: 'clipped, sarcastic' });
    expect((await listCharacters(db, u.id, n.id)).map((x) => x.name)).toEqual(['Mira Vale']);
    const up = await updateCharacter(db, u.id, c.id, { goals: 'free her brother' });
    expect(up.userEdited).toBe(true);
    expect(up.origin).toBe('user');
  });
  it('relationships require both characters in the same novel', async () => {
    const u = await makeUser(db); const n1 = await makeNovel(db, u.id); const n2 = await makeNovel(db, u.id);
    const a = await createCharacter(db, u.id, n1.id, { name: 'A' });
    const b = await createCharacter(db, u.id, n2.id, { name: 'B' });
    await expect(createRelationship(db, u.id, n1.id, { fromCharacterId: a.id, toCharacterId: b.id, type: 'trusts' })).rejects.toBeInstanceOf(ValidationError);
  });
  it('world entities by kind, with category for rules', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id);
    await createWorldEntity(db, u.id, n.id, 'world_rule', { name: 'Ash Oath', category: 'magic', description: 'Oaths sworn on ash bind the soul.' });
    await createWorldEntity(db, u.id, n.id, 'location', { name: "Gull's Rest", description: 'Fishing village.' });
    expect(await listWorldEntities(db, u.id, n.id, 'world_rule')).toHaveLength(1);
    const [loc] = await listWorldEntities(db, u.id, n.id, 'location');
    const up = await updateWorldEntity(db, u.id, 'location', loc.id, { description: 'Ruined fishing village.' });
    expect(up.userEdited).toBe(true);
  });
  it('timeline is ordered by chapter then order', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id);
    await createTimelineEvent(db, u.id, n.id, { chapterNumber: 2, description: 'B' });
    await createTimelineEvent(db, u.id, n.id, { chapterNumber: 1, description: 'A' });
    expect((await listTimeline(db, u.id, n.id)).map((e) => e.description)).toEqual(['A', 'B']);
  });
  it('cross-user isolation on bible records', async () => {
    const a = await makeUser(db); const b = await makeUser(db); const n = await makeNovel(db, a.id);
    const c = await createCharacter(db, a.id, n.id, { name: 'Secret' });
    await expect(getCharacter(db, b.id, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateCharacter(db, b.id, c.id, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteCharacter(db, b.id, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listCharacters(db, b.id, n.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('deleting a character cleans references', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id);
    const a = await createCharacter(db, u.id, n.id, { name: 'Ada' });
    const b = await createCharacter(db, u.id, n.id, { name: 'Bram' });
    await createRelationship(db, u.id, n.id, { fromCharacterId: a.id, toCharacterId: b.id, type: 'trusts' });
    await createTimelineEvent(db, u.id, n.id, { chapterNumber: 1, description: 'Ada meets Bram', characterIds: [a.id, b.id] });
    const ch = await createChapter(db, u.id, n.id, { number: 1, mainIdea: 'x', characterIds: [a.id, b.id] });
    await deleteCharacter(db, u.id, a.id);
    expect(await listRelationships(db, u.id, n.id, { includeInactive: true })).toHaveLength(0);
    const [ev] = await listTimeline(db, u.id, n.id);
    expect(ev.characterIds).toEqual([b.id]);
    const [chRow] = await db.select().from(s.chapters).where(eq(s.chapters.id, ch.id));
    expect(chRow.characterIds).toEqual([b.id]);
  });
});
