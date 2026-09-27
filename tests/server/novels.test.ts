import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '../helpers/db';
import { makeUser } from '../helpers/fixtures';
import { createNovel, listNovels, getNovel, updateNovel, deleteNovel, updateNovelSettings } from '@/server/services/novels';
import { NotFoundError, ValidationError } from '@/server/errors';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('novels service', () => {
  it('creates a novel with default settings', async () => {
    const u = await makeUser(db);
    const n = await createNovel(db, u.id, { title: 'The Ashen Crown', genre: 'Fantasy', premise: 'A thief inherits a cursed crown.' });
    const { novel, settings } = await getNovel(db, u.id, n.id);
    expect(novel.title).toBe('The Ashen Crown');
    expect(settings.dialogueBalance).toBe('balanced');
    expect(settings.contextTokenBudget).toBe(6000);
  });
  it('validates input', async () => {
    const u = await makeUser(db);
    await expect(createNovel(db, u.id, { title: '' })).rejects.toBeInstanceOf(ValidationError);
  });
  it('isolates users: others cannot read, list, update, delete', async () => {
    const a = await makeUser(db); const b = await makeUser(db);
    const n = await createNovel(db, a.id, { title: 'Private' });
    expect(await listNovels(db, b.id)).toHaveLength(0);
    await expect(getNovel(db, b.id, n.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateNovel(db, b.id, n.id, { title: 'Hacked' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateNovelSettings(db, b.id, n.id, { dialogueBalance: 'dialogue_heavy' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteNovel(db, b.id, n.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getNovel(db, a.id, n.id)).novel.title).toBe('Private');
  });
  it('treats malformed ids as not found', async () => {
    const u = await makeUser(db);
    await expect(getNovel(db, u.id, 'not-a-uuid')).rejects.toBeInstanceOf(NotFoundError);
  });
  it('updates settings', async () => {
    const u = await makeUser(db);
    const n = await createNovel(db, u.id, { title: 'S' });
    await updateNovelSettings(db, u.id, n.id, { dialogueBalance: 'narration_heavy', contextTokenBudget: 4000 });
    expect((await getNovel(db, u.id, n.id)).settings.dialogueBalance).toBe('narration_heavy');
  });
});
