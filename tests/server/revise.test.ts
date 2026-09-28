import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown } from '../helpers/fixtures';
import { saveManualVersion } from '@/server/services/versions';
import { submitFeedback, updateProposalItems, applyProposal, proposeFromCritic } from '@/server/feedback/service';
import { applyLocalRevision } from '@/server/ai/providers/local/draft';
import { createChapter } from '@/server/services/chapters';
import * as s from '@/server/db/schema';
import { NotFoundError, ValidationError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const empty = { whatWorked: '', whatDidnt: '', changesRequested: '', charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' };
const TEXT = ['Mira slipped into the customs house.', 'The tavern scene went on and on while the tavern keeper polished mugs in the tavern.', '“I do not like this,” Mira said. “It is too quiet.”'].join('\n\n');

describe('applyLocalRevision', () => {
  it('applies supported actions and reports unsupported ones', () => {
    const r = applyLocalRevision(TEXT, [
      { id: '1', change: 'Remove the tavern scene', rationale: '', action: 'remove', target: 'the tavern scene', scope: 'chapter', status: 'accepted' },
      { id: '2', change: 'Make dialogue casual', rationale: '', action: 'dialogue_casual', scope: 'global', status: 'accepted' },
      { id: '3', change: 'Make the heist scarier', rationale: '', action: 'rewrite', scope: 'chapter', status: 'accepted' },
    ]);
    expect(r.text).not.toContain('tavern keeper');
    expect(r.text).toContain('“I don’t like this,” Mira said. “It’s too quiet.”'.replace(/’/g, "'"));
    expect(r.applied).toEqual(['1', '2']);
    expect(r.notApplied).toEqual(['3']);
  });
});

describe('applyProposal', () => {
  async function setup() {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { mainIdea: 'Heist', requiredEvents: ['Mira slips into the customs house'] });
    const v = await saveManualVersion(ctx.db, u.id, ch.id, TEXT);
    const fb = await submitFeedback(ctx, u.id, { versionId: v.id, rating: 5, answers: { ...empty, remove: 'the tavern scene', dialogueNatural: 'Dialogue too formal.' } });
    return { u, ch, v, fb };
  }
  it('creates a revised child version from accepted items only', async () => {
    const { u, v, fb } = await setup();
    await updateProposalItems(ctx.db, u.id, fb.proposal.id, fb.proposal.items.map((i) => ({ id: i.id, status: i.action === 'remove' ? 'accepted' as const : 'rejected' as const })));
    const nv = await applyProposal(ctx, u.id, fb.proposal.id);
    expect(nv.source).toBe('revised');
    expect(nv.parentVersionId).toBe(v.id);
    expect(nv.content).not.toContain('tavern keeper');
    expect(nv.content).toContain('I do not like this'); // rejected item not applied
    const [f] = await ctx.db.select().from(s.chapterFeedback).where(eq(s.chapterFeedback.id, fb.feedback.id));
    expect(f.revisionVersionId).toBe(nv.id);
    const [orig] = await ctx.db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, v.id));
    expect(orig.content).toBe(TEXT); // never destructive
  });
  it('requires at least one accepted item', async () => {
    const { u, fb } = await setup();
    await expect(applyProposal(ctx, u.id, fb.proposal.id)).rejects.toBeInstanceOf(ValidationError);
  });
  it('isolates users', async () => {
    const { fb } = await setup(); const o = await makeUser(ctx.db);
    await expect(applyProposal(ctx, o.id, fb.proposal.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it('builds a proposal from critic findings ("Improve")', async () => {
    const { u, v } = await setup();
    const p = await proposeFromCritic(ctx, u.id, v.id);
    expect(p.source).toBe('critic');
    expect(p.items.length).toBeGreaterThan(0);
  });
});
