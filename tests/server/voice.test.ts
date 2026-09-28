import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter } from '../helpers/fixtures';
import { harvestDialogueLines, recomputeVoiceProfiles, updateVoiceProfile, getVoiceProfile, removeDialogueForVersion, resetVoiceField } from '@/server/voice/profile';
import { createChapter } from '@/server/services/chapters';
import { insertVersion } from '@/server/services/versions';
import * as s from '@/server/db/schema';
import { ConflictError, NotFoundError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
const MIRA = ['“Figures. Nobody pays on time,” Mira said.', '“Yeah, I don’t care,” Mira said.', '“Can’t stop now. Move,” Mira said.', '“Figures. Always the hard way,” Mira muttered.', '“Nah. We go tonight,” Mira said.', '“Bram, you’re slow,” Mira said.'];
const BRAM = ['“I do not believe that is wise,” Bram said.', '“Indeed, we must proceed with caution,” Bram said.', '“I am sworn to protect the realm,” Bram said.', '“Perhaps you are correct, Mira,” Bram said.', '“It is not our place to judge,” Bram said.'];

async function setup() {
  const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
  const { version } = await seedCanonChapter(ctx, u.id, w.novel.id, { number: 1, content: [...MIRA, ...BRAM].join('\n\n') });
  await harvestDialogueLines(ctx.db, { novelId: w.novel.id, versionId: version.id, chapterNumber: 1, content: version.content });
  await recomputeVoiceProfiles(ctx.db, w.novel.id);
  return { u, w, version };
}
beforeAll(async () => { ctx = await createTestContext(); });

describe('voice profiles', () => {
  it('derives distinct registers from canon dialogue', async () => {
    const { u, w } = await setup();
    const mira = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    const bram = await getVoiceProfile(ctx.db, u.id, w.bram.id);
    expect(mira.register).toBe('casual');
    expect(bram.register).toBe('formal');
    expect(mira.sentenceLength).toBe('short');
    expect(mira.verbalTics).toContain('Figures');          // line-opener used in ≥30% of her lines
    expect(mira.lexicalSignature).toContain('figures');
    expect(mira.sampleLines.length).toBeGreaterThan(0);
    expect(mira.lineCount).toBe(6);
    expect(mira.relationshipRegisters.length).toBeGreaterThanOrEqual(0);
  });
  it('refuses to harvest dialogue from non-canon drafts', async () => {
    const { u, w } = await setup();
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'draft' });
    const draft = await insertVersion(ctx.db, { chapter: ch, content: '“Hey,” Mira said.', source: 'generated' });
    await expect(harvestDialogueLines(ctx.db, { novelId: w.novel.id, versionId: draft.id, chapterNumber: ch.number, content: draft.content })).rejects.toBeInstanceOf(ConflictError);
  });
  it('keeps user-locked fields across recompute; reset clears the lock', async () => {
    const { u, w } = await setup();
    await updateVoiceProfile(ctx.db, u.id, w.mira.id, { register: 'neutral', avoid: ['indeed'], userVoiceNotes: 'Never says sorry.' });
    await recomputeVoiceProfiles(ctx.db, w.novel.id);
    let p = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(p.register).toBe('neutral');
    expect(p.avoid).toEqual(['indeed']);
    expect(p.userVoiceNotes).toBe('Never says sorry.');
    expect(p.lockedFields).toEqual(expect.arrayContaining(['register', 'avoid']));
    await resetVoiceField(ctx.db, u.id, w.mira.id, 'register');
    p = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(p.register).toBe('casual');
  });
  it('removes lines when a version is retracted', async () => {
    const { u, w, version } = await setup();
    await removeDialogueForVersion(ctx.db, version.id);
    await recomputeVoiceProfiles(ctx.db, w.novel.id);
    const p = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(p.lineCount).toBe(0);
  });
  it('isolates users', async () => {
    const { w } = await setup(); const other = await makeUser(ctx.db);
    await expect(getVoiceProfile(ctx.db, other.id, w.mira.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateVoiceProfile(ctx.db, other.id, w.mira.id, { register: 'formal' })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('stores dialogue lines with speaker ids', async () => {
    const { w } = await setup();
    const rows = await ctx.db.select().from(s.dialogueLines).where(eq(s.dialogueLines.characterId, w.bram.id));
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});
