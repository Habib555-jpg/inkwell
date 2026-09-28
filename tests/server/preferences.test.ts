import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { createChapter } from '@/server/services/chapters';
import { saveManualVersion } from '@/server/services/versions';
import { submitFeedback } from '@/server/feedback/service';
import { listPreferences, setPreferenceStatus, listVoiceNoteCandidates, resolveVoiceNote, createPreference } from '@/server/feedback/preferences';
import { getVoiceProfile } from '@/server/voice/profile';
import * as s from '@/server/db/schema';
import { NotFoundError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const empty = { whatWorked: '', whatDidnt: '', changesRequested: '', charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' };

async function novel() {
  const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
  const versions: string[] = [];
  for (let i = 0; i < 4; i++) { const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: `c${i}` }); versions.push((await saveManualVersion(ctx.db, u.id, ch.id, 'Text.')).id); }
  const fb = (vi: number, answers: Partial<typeof empty>, rating = 6) => submitFeedback(ctx, u.id, { versionId: versions[vi], rating, answers: { ...empty, ...answers } });
  return { u, w, fb };
}

describe('preference promotion', () => {
  it('global style theme: candidate at 2, active at 3 across 2 chapters', async () => {
    const { u, w, fb } = await novel();
    await fb(0, { dialogueNatural: 'The dialogue is too formal.' });
    await fb(0, { dialogueNatural: 'Dialogue is too stiff.' });
    let p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect(p.global.find((x) => x.themeKey === 'dialogue.too_formal')?.status).toBe('candidate');
    await fb(0, { dialogueNatural: 'Still too formal dialogue.' });
    p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect(p.global.find((x) => x.themeKey === 'dialogue.too_formal')?.status).toBe('candidate'); // 3 but only 1 chapter
    await fb(1, { dialogueNatural: 'Too formal again.' });
    p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect(p.global.find((x) => x.themeKey === 'dialogue.too_formal')?.status).toBe('active');
  });
  it('chapter-scoped feedback never becomes a preference', async () => {
    const { u, w, fb } = await novel();
    for (let i = 0; i < 4; i++) await fb(i, { whatDidnt: 'In this chapter the ending dragged.' });
    const p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect([...p.global, ...p.story, ...p.character]).toHaveLength(0);
    expect(p.chapterNotes.length).toBe(4);
  });
  it('a low rating alone creates nothing', async () => {
    const { u, w, fb } = await novel();
    await fb(0, {}, 1); await fb(1, {}, 1); await fb(2, {}, 1);
    const p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect([...p.global, ...p.story, ...p.character]).toHaveLength(0);
  });
  it('user dismissal sticks despite new evidence', async () => {
    const { u, w, fb } = await novel();
    await fb(0, { dialogueNatural: 'Too formal dialogue.' }); await fb(1, { dialogueNatural: 'Too formal dialogue.' });
    const cand = (await listPreferences(ctx.db, u.id, w.novel.id)).global[0];
    await setPreferenceStatus(ctx.db, u.id, cand.id, 'dismissed');
    await fb(2, { dialogueNatural: 'Too formal dialogue.' }); await fb(3, { dialogueNatural: 'Too formal dialogue.' });
    expect((await listPreferences(ctx.db, u.id, w.novel.id)).global[0].status).toBe('dismissed');
  });
  it('character voice feedback becomes a pending note and a never-auto-active candidate', async () => {
    const { u, w, fb } = await novel();
    await fb(0, { charactersOk: 'Mira sounds too formal.' });
    await fb(1, { charactersOk: 'Mira sounds too formal again.' });
    await fb(2, { charactersOk: 'Mira is too formal.' });
    const p = await listPreferences(ctx.db, u.id, w.novel.id);
    expect(p.character[0].status).toBe('candidate');
    expect(p.character[0].characterName).toBe('Mira Vale');
    const notes = await listVoiceNoteCandidates(ctx.db, u.id, w.novel.id);
    expect(notes.length).toBe(3);
    const before = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(before.userVoiceNotes).toBe('');
    await resolveVoiceNote(ctx.db, u.id, notes[0].id, true);
    await resolveVoiceNote(ctx.db, u.id, notes[1].id, false);
    const after = await getVoiceProfile(ctx.db, u.id, w.mira.id);
    expect(after.userVoiceNotes).toContain('Mira sounds too formal.');
    expect(after.userVoiceNotes).not.toContain('again');
  });
  it('user-authored preferences are active and isolated', async () => {
    const { u, w } = await novel(); const o = await makeUser(ctx.db);
    const p = await createPreference(ctx.db, u.id, w.novel.id, { scope: 'global', statement: 'No em dashes.' });
    expect(p.status).toBe('active');
    await expect(setPreferenceStatus(ctx.db, o.id, p.id, 'dismissed')).rejects.toBeInstanceOf(NotFoundError);
    const [row] = await ctx.db.select().from(s.writingPreferences).where(eq(s.writingPreferences.id, p.id));
    expect(row.origin).toBe('user');
  });
});
