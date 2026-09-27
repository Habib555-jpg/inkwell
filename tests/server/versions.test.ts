import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { makeUser, makeNovel } from '../helpers/fixtures';
import { createChapter, getChapterDetail } from '@/server/services/chapters';
import { saveManualVersion, autosaveVersion, restoreVersion, deleteVersion, compareVersions, insertVersion } from '@/server/services/versions';
import * as s from '@/server/db/schema';
import { ConflictError, NotFoundError } from '@/server/errors';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

async function setup() {
  const u = await makeUser(db); const n = await makeNovel(db, u.id);
  const ch = await createChapter(db, u.id, n.id, { mainIdea: 'x' });
  return { u, n, ch };
}

describe('versions', () => {
  it('numbers versions monotonically and never overwrites', async () => {
    const { u, ch } = await setup();
    const v1 = await saveManualVersion(db, u.id, ch.id, 'one');
    const v2 = await insertVersion(db, { chapter: ch, content: 'two', source: 'generated' });
    expect([v1.versionNumber, v2.versionNumber]).toEqual([1, 2]);
    const detail = await getChapterDetail(db, u.id, ch.id);
    expect(detail.chapter.currentVersionId).toBe(v2.id);
    expect(detail.chapter.status).toBe('drafting');
    expect(detail.versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });
  it('autosave updates a leaf manual version in place', async () => {
    const { u, ch } = await setup();
    const v1 = await saveManualVersion(db, u.id, ch.id, 'draft');
    const r = await autosaveVersion(db, u.id, v1.id, 'draft edited');
    expect(r.forked).toBe(false);
    expect(r.version.id).toBe(v1.id);
    expect(r.version.content).toBe('draft edited');
    expect(r.version.wordCount).toBe(2);
  });
  it('autosave on a generated version forks a manual child', async () => {
    const { u, ch } = await setup();
    const g = await insertVersion(db, { chapter: ch, content: 'gen text', source: 'generated' });
    const r = await autosaveVersion(db, u.id, g.id, 'gen text edited');
    expect(r.forked).toBe(true);
    expect(r.version.parentVersionId).toBe(g.id);
    const [orig] = await db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, g.id));
    expect(orig.content).toBe('gen text');
  });
  it('autosave on a canon version forks', async () => {
    const { u, ch } = await setup();
    const v = await saveManualVersion(db, u.id, ch.id, 'canon text');
    await db.update(s.chapterVersions).set({ isCanon: true }).where(eq(s.chapterVersions.id, v.id));
    await db.update(s.chapters).set({ approvedVersionId: v.id, status: 'approved' }).where(eq(s.chapters.id, ch.id));
    const r = await autosaveVersion(db, u.id, v.id, 'changed after approval');
    expect(r.forked).toBe(true);
    const [orig] = await db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, v.id));
    expect(orig.content).toBe('canon text');
    const detail = await getChapterDetail(db, u.id, ch.id);
    expect(detail.chapter.status).toBe('canon_changed');
  });
  it('restore creates a new version copying content', async () => {
    const { u, ch } = await setup();
    const v1 = await saveManualVersion(db, u.id, ch.id, 'first');
    await insertVersion(db, { chapter: ch, content: 'second', source: 'generated' });
    const r = await restoreVersion(db, u.id, v1.id);
    expect(r.source).toBe('restored');
    expect(r.content).toBe('first');
    expect(r.versionNumber).toBe(3);
  });
  it('cannot delete canon or current versions; can soft-delete others', async () => {
    const { u, ch } = await setup();
    const v1 = await saveManualVersion(db, u.id, ch.id, 'a');
    const v2 = await insertVersion(db, { chapter: ch, content: 'b', source: 'generated' });
    await expect(deleteVersion(db, u.id, v2.id)).rejects.toBeInstanceOf(ConflictError);
    await deleteVersion(db, u.id, v1.id);
    const detail = await getChapterDetail(db, u.id, ch.id);
    expect(detail.versions.map((v) => v.id)).toEqual([v2.id]);
  });
  it('compares two versions word-by-word', async () => {
    const { u, ch } = await setup();
    const a = await saveManualVersion(db, u.id, ch.id, 'The crown was cold.');
    const b = await insertVersion(db, { chapter: ch, content: 'The crown was burning.', source: 'generated' });
    const { diff } = await compareVersions(db, u.id, a.id, b.id);
    expect(diff.some((p) => p.removed && p.value.includes('cold'))).toBe(true);
    expect(diff.some((p) => p.added && p.value.includes('burning'))).toBe(true);
  });
  it('other users cannot touch versions', async () => {
    const { u, ch } = await setup(); const other = await makeUser(db);
    const v = await saveManualVersion(db, u.id, ch.id, 'mine');
    await expect(autosaveVersion(db, other.id, v.id, 'theirs')).rejects.toBeInstanceOf(NotFoundError);
    await expect(restoreVersion(db, other.id, v.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
