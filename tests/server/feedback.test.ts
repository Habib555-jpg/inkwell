import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { generateDraft } from '@/server/pipeline/generate';
import { submitFeedback, updateProposalItems, ratingHistory } from '@/server/feedback/service';
import { analyzeFeedbackLocal } from '@/server/ai/providers/local/feedback';
import { createChapter } from '@/server/services/chapters';
import * as s from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const empty = { whatWorked: '', whatDidnt: '', changesRequested: '', charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' };
const chars = [{ id: 'm', name: 'Mira Vale', aliases: ['Mira'] }];

describe('local feedback analysis', () => {
  it('separates global, chapter and character scopes', () => {
    const a = analyzeFeedbackLocal({ rating: 6, chapterNumber: 3, characters: chars, answers: {
      ...empty,
      dialogueNatural: 'No — the dialogue is too formal.',
      whatDidnt: 'In this chapter the ending dragged.',
      charactersOk: 'Mira sounds too formal, she would never talk like that.',
      remove: 'the tavern scene',
      whatWorked: 'The heist was great.',
    } });
    expect(a.themes.find((x) => x.themeKey === 'dialogue.too_formal' && !x.characterId)?.scope).toBe('global');
    expect(a.themes.find((x) => x.themeKey === 'pacing.too_slow')?.scope).toBe('chapter');
    expect(a.themes.find((x) => x.characterId === 'm')?.scope).toBe('character');
    const rm = a.items.find((i) => i.action === 'remove');
    expect(rm?.scope).toBe('chapter');
    expect(rm?.target).toBe('the tavern scene');
    expect(a.items.some((i) => i.change.includes('heist was great'))).toBe(false);
  });
  it('ignores bare affirmatives and low ratings alone', () => {
    const a = analyzeFeedbackLocal({ rating: 2, chapterNumber: 1, characters: chars, answers: { ...empty, charactersOk: 'yes', followedInstructions: 'Yes.' } });
    expect(a.items).toHaveLength(0);
    expect(a.themes).toHaveLength(0);
  });
});

describe('submitFeedback', () => {
  async function draft() {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'Heist', requiredEvents: ['Mira steals the ledger'], characterIds: [w.mira.id] });
    const { version } = await generateDraft(ctx, u.id, ch.id);
    return { u, w, ch, version };
  }
  it('stores rating, answers, themes and a proposal', async () => {
    const { u, version } = await draft();
    const r = await submitFeedback(ctx, u.id, { versionId: version.id, rating: 7.5, answers: { ...empty, dialogueNatural: 'The dialogue is too formal.', remove: 'the opening recap' } });
    expect(r.feedback.rating).toBe(7.5);
    expect(r.proposal.items.length).toBeGreaterThanOrEqual(2);
    const themes = await ctx.db.select().from(s.feedbackThemes).where(eq(s.feedbackThemes.feedbackId, r.feedback.id));
    expect(themes.map((t) => t.themeKey)).toContain('dialogue.too_formal');
  });
  it('validates rating range and half steps', async () => {
    const { u, version } = await draft();
    await expect(submitFeedback(ctx, u.id, { versionId: version.id, rating: 10.5, answers: empty })).rejects.toBeInstanceOf(ValidationError);
    await expect(submitFeedback(ctx, u.id, { versionId: version.id, rating: 7.3, answers: empty })).rejects.toBeInstanceOf(ValidationError);
  });
  it('lets the user override an item scope, updating stored themes', async () => {
    const { u, version } = await draft();
    const r = await submitFeedback(ctx, u.id, { versionId: version.id, rating: 6, answers: { ...empty, dialogueNatural: 'The dialogue is too formal.' } });
    const item = r.proposal.items.find((i) => i.action === 'dialogue_casual')!;
    await updateProposalItems(ctx.db, u.id, r.proposal.id, [{ id: item.id, scope: 'chapter', status: 'accepted' }]);
    const [theme] = await ctx.db.select().from(s.feedbackThemes).where(eq(s.feedbackThemes.feedbackId, r.feedback.id));
    expect(theme.scope).toBe('chapter');
  });
  it('isolates users', async () => {
    const { version } = await draft(); const other = await makeUser(ctx.db);
    await expect(submitFeedback(ctx, other.id, { versionId: version.id, rating: 5, answers: empty })).rejects.toBeInstanceOf(NotFoundError);
  });
  it('reports rating history per chapter', async () => {
    const { u, w, version } = await draft();
    await submitFeedback(ctx, u.id, { versionId: version.id, rating: 6, answers: empty });
    await submitFeedback(ctx, u.id, { versionId: version.id, rating: 8, answers: empty });
    const h = await ratingHistory(ctx.db, u.id, w.novel.id);
    expect(h[0].versions.map((v) => v.rating)).toEqual([6, 8]);
  });
});
