import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter } from '../helpers/fixtures';
import { applyExtraction } from '@/server/canon/extract';
import { updateCharacter } from '@/server/services/characters';
import * as s from '@/server/db/schema';
import type { AppContext } from '@/server/context';
import type { ExtractedFacts } from '@/server/ai/types';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const none: ExtractedFacts = { characters: [], locations: [], factions: [], objects: [], worldRules: [], events: [], relationships: [], revelations: [] };

async function setup() {
  const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
  const { version } = await seedCanonChapter(ctx, u.id, w.novel.id, { number: 5, content: 'x' });
  return { u, w, version };
}
const apply = (w: { novel: { id: string } }, versionId: string, facts: Partial<ExtractedFacts>, chapterNumber = 5, latestCanonNumber = 5) =>
  applyExtraction(ctx.db, { novelId: w.novel.id, versionId, chapterNumber, latestCanonNumber }, { ...none, ...facts });

describe('applyExtraction', () => {
  it('inserts new entities, events and relationships with provenance', async () => {
    const { w, version } = await setup();
    const r = await apply(w, version.id, {
      characters: [{ name: 'Tovin Rask', description: 'A broker.' }], locations: [{ name: 'Vey Harbor' }],
      events: [{ description: 'Mira meets Tovin Rask at Vey Harbor.', characterNames: ['Mira', 'Tovin Rask'], locationName: 'Vey Harbor', importance: 2 }],
      relationships: [{ from: 'Tovin Rask', to: 'Mira Vale', type: 'owes' }],
    });
    expect(r.added.characters).toBe(1); expect(r.added.locations).toBe(1); expect(r.added.events).toBe(1); expect(r.added.relationships).toBe(1);
    const [tovin] = await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)));
    expect(tovin.origin).toBe('extracted');
    expect(tovin.sourceChapterVersionId).toBe(version.id);
    const [ev] = await ctx.db.select().from(s.timelineEvents).where(eq(s.timelineEvents.sourceChapterVersionId, version.id));
    expect(ev.characterIds).toContain(tovin.id);
  });
  it('conflicts instead of overwriting user-authored state', async () => {
    const { u, w, version } = await setup();
    await updateCharacter(ctx.db, u.id, w.bram.id, { currentStatus: 'alive' });
    const r = await apply(w, version.id, { characters: [{ name: 'Bram', status: 'dead' }] });
    expect(r.conflicts).toBe(1);
    const [bram] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.bram.id));
    expect(bram.currentStatus).toBe('alive');
    const [c] = await ctx.db.select().from(s.memoryConflicts).where(eq(s.memoryConflicts.entityId, w.bram.id));
    expect([c.field, c.existingValue, c.proposedValue, c.status]).toEqual(['currentStatus', 'alive', 'dead', 'open']);
  });
  it('fills empty fields even for user-created characters', async () => {
    const { w, version } = await setup();
    await apply(w, version.id, { characters: [{ name: 'Mira', locationName: "Gull's Rest" }] });
    const [mira] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.mira.id));
    expect(mira.currentLocationId).not.toBeNull();
  });
  it('progresses extracted characters on the latest chapter, recording from→to', async () => {
    const { w, version } = await setup();
    await apply(w, version.id, { characters: [{ name: 'Tovin Rask', locationName: 'Vey Harbor' }] });
    await apply(w, version.id, { characters: [{ name: 'Tovin Rask', locationName: "Gull's Rest" }] });
    const [t] = await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)));
    const [loc] = await ctx.db.select().from(s.locations).where(eq(s.locations.id, t.currentLocationId!));
    expect(loc.name).toBe("Gull's Rest");
    const facts = await ctx.db.select().from(s.chapterFacts).where(and(eq(s.chapterFacts.kind, 'character_state'), eq(s.chapterFacts.novelId, w.novel.id)));
    expect(facts.some((f) => JSON.parse(f.content).from !== null)).toBe(true);
  });
  it('older chapter does not overwrite later state', async () => {
    const { w, version } = await setup();
    await apply(w, version.id, { characters: [{ name: 'Tovin Rask', locationName: 'Vey Harbor' }] }, 5, 5);
    const r = await apply(w, version.id, { characters: [{ name: 'Tovin Rask', locationName: "Gull's Rest" }] }, 3, 5);
    expect(r.conflicts).toBe(1);
    const [t] = await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)));
    const [loc] = await ctx.db.select().from(s.locations).where(eq(s.locations.id, t.currentLocationId!));
    expect(loc.name).toBe('Vey Harbor');
  });
  it('relationship type changes become conflicts; duplicates are skipped', async () => {
    const { w, version } = await setup();
    const same = await apply(w, version.id, { relationships: [{ from: 'Mira', to: 'Bram', type: 'Distrusts' }] });
    expect(same.added.relationships + same.conflicts).toBe(0);
    const changed = await apply(w, version.id, { relationships: [{ from: 'Mira', to: 'Bram', type: 'trusts' }] });
    expect(changed.conflicts).toBe(1);
    const rels = await ctx.db.select().from(s.characterRelationships).where(eq(s.characterRelationships.fromCharacterId, w.mira.id));
    expect(rels.map((r) => r.type)).toEqual(['distrusts']);
  });
  it('dead-to-alive always conflicts, even for extracted characters', async () => {
    const { w, version } = await setup();
    await apply(w, version.id, { characters: [{ name: 'Tovin Rask', status: 'dead' }] });
    const r = await apply(w, version.id, { characters: [{ name: 'Tovin Rask', status: 'injured' }] });
    expect(r.conflicts).toBe(1);
  });
  it('world rule wording differences conflict; near-duplicates skip', async () => {
    const { w, version } = await setup();
    const dup = await apply(w, version.id, { worldRules: [{ name: 'Ash Oath', category: 'magic', description: 'An oath sworn over ash binds the swearer until death.' }] });
    expect(dup.added.worldRules + dup.conflicts).toBe(0);
    const diff = await apply(w, version.id, { worldRules: [{ name: 'Ash Oath', category: 'magic', description: 'Ash oaths can be broken by a priest.' }] });
    expect(diff.conflicts).toBe(1);
  });
});
