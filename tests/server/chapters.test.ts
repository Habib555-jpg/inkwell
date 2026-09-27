import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '../helpers/db';
import { makeUser, makeNovel } from '../helpers/fixtures';
import { createChapter, listChapters, updateChapter, getChapterDetail, chapterNumbersForVersions } from '@/server/services/chapters';
import { saveManualVersion } from '@/server/services/versions';
import { createCharacter } from '@/server/services/characters';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('chapters', () => {
  it('auto-numbers and stores requirements', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id);
    const mira = await createCharacter(db, u.id, n.id, { name: 'Mira' });
    const c1 = await createChapter(db, u.id, n.id, { mainIdea: 'Heist', requiredEvents: ['Mira steals the crown'], forbiddenEvents: ['Mira dies'], characterIds: [mira.id], dialoguePoints: ['Mira jokes about the guards'] });
    const c2 = await createChapter(db, u.id, n.id, { mainIdea: 'Escape' });
    expect([c1.number, c2.number]).toEqual([1, 2]);
    expect(c1.requiredEvents).toEqual(['Mira steals the crown']);
    expect(c1.status).toBe('planning');
  });
  it('rejects duplicate numbers and foreign characters', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id); const other = await makeNovel(db, u.id);
    const x = await createCharacter(db, u.id, other.id, { name: 'X' });
    await createChapter(db, u.id, n.id, { number: 3, mainIdea: 'a' });
    await expect(createChapter(db, u.id, n.id, { number: 3, mainIdea: 'b' })).rejects.toBeInstanceOf(ConflictError);
    await expect(createChapter(db, u.id, n.id, { mainIdea: 'c', characterIds: [x.id] })).rejects.toBeInstanceOf(ValidationError);
  });
  it('lists in number order and isolates users', async () => {
    const a = await makeUser(db); const b = await makeUser(db); const n = await makeNovel(db, a.id);
    await createChapter(db, a.id, n.id, { number: 2, mainIdea: 'b' });
    const c1 = await createChapter(db, a.id, n.id, { number: 1, mainIdea: 'a' });
    expect((await listChapters(db, a.id, n.id)).map((c) => c.number)).toEqual([1, 2]);
    await expect(getChapterDetail(db, b.id, c1.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateChapter(db, b.id, c1.id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('maps version ids to chapter numbers within one novel only', async () => {
    const u = await makeUser(db); const n = await makeNovel(db, u.id); const other = await makeNovel(db, u.id);
    const c = await createChapter(db, u.id, n.id, { number: 4, mainIdea: 'x' });
    const v = await saveManualVersion(db, u.id, c.id, 'text');
    const oc = await createChapter(db, u.id, other.id, { number: 9, mainIdea: 'y' });
    const ov = await saveManualVersion(db, u.id, oc.id, 'text');
    const m = await chapterNumbersForVersions(db, n.id, [v.id, ov.id]);
    expect(m.get(v.id)).toBe(4);
    expect(m.has(ov.id)).toBe(false);
  });
});
