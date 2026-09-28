// Regression tests for the final whole-branch review findings (C1, I1–I5).
import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { approveVersion } from '@/server/canon/approve';
import { resolveConflict, listConflicts } from '@/server/canon/conflicts';
import { createChapter, updateChapter } from '@/server/services/chapters';
import { saveManualVersion, autosaveVersion } from '@/server/services/versions';
import { createRelationship } from '@/server/services/relationships';
import { updateCharacter } from '@/server/services/characters';
import { updateVoiceProfile, getVoiceProfile } from '@/server/voice/profile';
import { buildContextPack } from '@/server/memory/retrieve';
import { runDraftChecks } from '@/server/pipeline/checks';
import { nextAutosaveStep } from '@/lib/autosave-policy';
import { clientIp } from '@/server/security/client-ip';
import * as s from '@/server/db/schema';
import { ConflictError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });

const CH1 = [
  'Mira arrived at Vey Harbor before dawn.',
  '“You’re late,” Tovin Rask said. Tovin Rask was a broker for the Grey Guild.',
  '“Figures,” Mira said. “Nobody pays on time.”',
].join('\n\n');

describe('C1: re-approving a chapter keeps memory the user and later chapters built on', () => {
  it('a typo fix keeps the extracted entity id, user relationships, voice notes and other chapters’ references', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch1 = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'Arrival' });
    const v1 = await saveManualVersion(ctx.db, u.id, ch1.id, CH1);
    await approveVersion(ctx, u.id, v1.id);
    const tovin = (await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id))))[0];
    await createRelationship(ctx.db, u.id, w.novel.id, { fromCharacterId: w.mira.id, toCharacterId: tovin.id, type: 'suspects' });
    await updateVoiceProfile(ctx.db, u.id, tovin.id, { userVoiceNotes: 'Oily, precise, never raises his voice.' });
    const ch2 = await createChapter(ctx.db, u.id, w.novel.id, { number: 2, mainIdea: 'Deal', characterIds: [w.mira.id, tovin.id] });

    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v1.id, CH1.replace('before dawn', 'just before dawn'));
    await approveVersion(ctx, u.id, v2.id);

    const tovins = await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id)));
    expect(tovins.map((t) => t.id)).toEqual([tovin.id]);
    const rel = await ctx.db.select().from(s.characterRelationships).where(eq(s.characterRelationships.toCharacterId, tovin.id));
    expect(rel.map((r) => r.type)).toContain('suspects');
    expect((await getVoiceProfile(ctx.db, u.id, tovin.id)).userVoiceNotes).toContain('Oily');
    await expect(updateChapter(ctx.db, u.id, ch2.id, { mainIdea: 'Deal, revised', characterIds: [w.mira.id, tovin.id] })).resolves.toBeTruthy();
  });

  it('an entity the new version no longer mentions but that something else references becomes a conflict, not a deletion', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch1 = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'Arrival' });
    const v1 = await saveManualVersion(ctx.db, u.id, ch1.id, CH1);
    await approveVersion(ctx, u.id, v1.id);
    const tovin = (await ctx.db.select().from(s.characters).where(and(eq(s.characters.name, 'Tovin Rask'), eq(s.characters.novelId, w.novel.id))))[0];
    await createChapter(ctx.db, u.id, w.novel.id, { number: 2, mainIdea: 'Deal', characterIds: [tovin.id] });
    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v1.id, 'Mira waited alone at Vey Harbor.');
    await approveVersion(ctx, u.id, v2.id);
    expect((await ctx.db.select().from(s.characters).where(eq(s.characters.id, tovin.id))).length).toBe(1);
    const conflicts = await listConflicts(ctx.db, u.id, w.novel.id);
    expect(conflicts.some((c) => c.kind === 'retracted_record' && c.entityId === tovin.id)).toBe(true);
  });
});

describe('I1: chapter N only sees story state from chapters before N', () => {
  it('drafting chapter 3 after chapter 5 is canon leaks no chapter-5 status, samples or relationships', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch5 = await createChapter(ctx.db, u.id, w.novel.id, { number: 5, mainIdea: 'Fall' });
    const v5 = await saveManualVersion(ctx.db, u.id, ch5.id, ['Bram Holt died at the gate.', '“Traitor. Never again,” Mira said.', 'Mira trusts Cass now.'].join('\n\n'));
    await approveVersion(ctx, u.id, v5.id);
    const ch3 = await createChapter(ctx.db, u.id, w.novel.id, { number: 3, mainIdea: 'Mira and Bram and Cass ride north', characterIds: [w.mira.id, w.bram.id, w.cass.id] });
    const pack = await buildContextPack(ctx, ch3);
    expect(pack.characters.find((c) => c.name === 'Bram Holt')?.currentStatus).not.toMatch(/dead/);
    expect(pack.characters.find((c) => c.name === 'Mira Vale')?.voice.sampleLines.every((x) => x.chapterNumber < 3)).toBe(true);
    expect(pack.relationships.some((r) => r.type === 'trusts' && r.toName === 'Cass Orrin')).toBe(false);
    const checks = await runDraftChecks(ctx, ch3, pack, '“Ride on,” Bram said. Mira and Bram and Cass ride north.', u.id);
    expect(checks.continuity.issues.some((i) => i.category === 'dead_character_acts')).toBe(false);
  });
});

describe('I2: a conflict decision is the user’s, and survives re-approval', () => {
  it('accept_new on a relationship then re-approving the chapter keeps an active relationship', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'x' });
    const v1 = await saveManualVersion(ctx.db, u.id, ch.id, 'Mira trusts Bram now. Mira trusts Bram completely.');
    await approveVersion(ctx, u.id, v1.id);
    const c = (await listConflicts(ctx.db, u.id, w.novel.id)).find((x) => x.kind === 'relationship')!;
    await resolveConflict(ctx.db, u.id, c.id, 'accept_new');
    const { version: v2 } = await autosaveVersion(ctx.db, u.id, v1.id, 'Mira watched Bram across the fire.'); // no longer states it: the user's decision must stand
    await approveVersion(ctx, u.id, v2.id);
    const active = await ctx.db.select().from(s.characterRelationships)
      .where(and(eq(s.characterRelationships.fromCharacterId, w.mira.id), eq(s.characterRelationships.toCharacterId, w.bram.id), eq(s.characterRelationships.active, true)));
    expect(active.map((r) => r.type)).toEqual(['trusts']);
  });
  it('merge on a field marks the record as user-edited', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await updateCharacter(ctx.db, u.id, w.bram.id, { currentStatus: 'alive' });
    await ctx.db.update(s.characters).set({ userEdited: false }).where(eq(s.characters.id, w.bram.id));
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'x' });
    const v = await saveManualVersion(ctx.db, u.id, ch.id, 'Bram was killed at the pier.');
    await approveVersion(ctx, u.id, v.id);
    const c = (await listConflicts(ctx.db, u.id, w.novel.id)).find((x) => x.field === 'currentStatus')!;
    await resolveConflict(ctx.db, u.id, c.id, 'merge', 'missing');
    const [b] = await ctx.db.select().from(s.characters).where(eq(s.characters.id, w.bram.id));
    expect([b.currentStatus, b.userEdited]).toEqual(['missing', true]);
  });
});

describe('I3: approval commits exactly the text that was read', () => {
  it('rejects approval when the version changed since the client last saw it', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 1, mainIdea: 'x' });
    const v = await saveManualVersion(ctx.db, u.id, ch.id, 'First text of the chapter.');
    const stale = v.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await autosaveVersion(ctx.db, u.id, v.id, 'Edited text of the chapter.');
    await expect(approveVersion(ctx, u.id, v.id, { expectedUpdatedAt: stale })).rejects.toBeInstanceOf(ConflictError);
    const [row] = await ctx.db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, v.id));
    expect(row.isCanon).toBe(false);
  });
});

describe('I4: autosave never retries a permanent failure forever', () => {
  it('maps error codes to the right recovery', () => {
    expect(nextAutosaveStep('not_found')).toBe('save_as_new_version');
    expect(nextAutosaveStep('validation')).toBe('stop_and_show');
    expect(nextAutosaveStep('unauthorized')).toBe('stop_and_show');
    expect(nextAutosaveStep('conflict')).toBe('save_as_new_version');
    expect(nextAutosaveStep('internal')).toBe('retry');
    expect(nextAutosaveStep('rate_limited')).toBe('retry');
  });
});

describe('I5: sign-in throttling is keyed by client IP', () => {
  it('reads the client IP from proxy headers', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
