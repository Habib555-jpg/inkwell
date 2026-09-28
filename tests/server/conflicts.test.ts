import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter } from '../helpers/fixtures';
import { applyExtraction } from '@/server/canon/extract';
import { resolveConflict, listConflicts } from '@/server/canon/conflicts';
import { updateCharacter } from '@/server/services/characters';
import * as s from '@/server/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';
import type { AppContext } from '@/server/context';
import type { ExtractedFacts } from '@/server/ai/types';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const none: ExtractedFacts = { characters: [], locations: [], factions: [], objects: [], worldRules: [], events: [], relationships: [], revelations: [] };

async function withConflicts() {
  const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
  const { version } = await seedCanonChapter(ctx, u.id, w.novel.id, { number: 5, content: 'x' });
  await updateCharacter(ctx.db, u.id, w.bram.id, { currentStatus: 'alive' });
  await applyExtraction(ctx.db, { novelId: w.novel.id, versionId: version.id, chapterNumber: 5, latestCanonNumber: 5 }, {
    ...none, characters: [{ name: 'Bram', status: 'dead' }], relationships: [{ from: 'Mira', to: 'Bram', type: 'trusts' }],
  });
  const conflicts = await listConflicts(ctx.db, u.id, w.novel.id);
  return { u, w, conflicts, byField: (f: string) => conflicts.find((c) => c.field === f)! };
}

describe('conflict resolution', () => {
  it('keep_existing leaves canon untouched', async () => {
    const { u, w, byField } = await withConflicts();
    await resolveConflict(ctx.db, u.id, byField('currentStatus').id, 'keep_existing');
    const [b] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.bram.id));
    expect(b.currentStatus).toBe('alive');
    expect((await listConflicts(ctx.db, u.id, w.novel.id)).length).toBe(1);
  });
  it('accept_new applies the proposed value', async () => {
    const { u, w, byField } = await withConflicts();
    await resolveConflict(ctx.db, u.id, byField('currentStatus').id, 'accept_new');
    const [b] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.bram.id));
    expect(b.currentStatus).toBe('dead');
  });
  it('accept_new on a relationship deactivates the old and adds the new', async () => {
    const { u, w, byField } = await withConflicts();
    await resolveConflict(ctx.db, u.id, byField('type').id, 'accept_new');
    const rels = await ctx.db.select().from(s.characterRelationships).where(eq(s.characterRelationships.fromCharacterId, w.mira.id));
    expect(rels.filter((r) => r.active).map((r) => r.type)).toEqual(['trusts']);
    expect(rels.filter((r) => !r.active).map((r) => r.type)).toEqual(['distrusts']);
  });
  it('merge requires a value and applies it', async () => {
    const { u, w, byField } = await withConflicts();
    await expect(resolveConflict(ctx.db, u.id, byField('currentStatus').id, 'merge')).rejects.toBeInstanceOf(ValidationError);
    await resolveConflict(ctx.db, u.id, byField('currentStatus').id, 'merge', 'missing, presumed dead');
    const [b] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.bram.id));
    expect(b.currentStatus).toBe('missing, presumed dead');
  });
  it('cannot resolve twice; isolates users', async () => {
    const { u, byField } = await withConflicts(); const o = await makeUser(ctx.db);
    const id = byField('currentStatus').id;
    await expect(resolveConflict(ctx.db, o.id, id, 'accept_new')).rejects.toBeInstanceOf(NotFoundError);
    await resolveConflict(ctx.db, u.id, id, 'keep_existing');
    await expect(resolveConflict(ctx.db, u.id, id, 'accept_new')).rejects.toBeInstanceOf(ConflictError);
  });
});
