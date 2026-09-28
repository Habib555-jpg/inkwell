import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { AppContext } from '../context';
import { getChapterForUser, getVersionForUser, assertNovelOwner } from '../services/access';
import { NotFoundError, ValidationError } from '../errors';
import { parse, longText } from '../validation';
import { feedbackAnalysisSchema, scopeSchema } from '../ai/schemas';
import { buildFeedbackPrompt } from '../ai/prompts/feedback';
import { recordUsage } from '../ai/usage';
import { checkRateLimit } from '../security/rate-limit';
import { getEnv } from '../env';
import type { FeedbackAnalysis, RevisionItem } from '../ai/types';
import { afterFeedbackThemes } from './preferences';
import { reviseFromProposal } from '../pipeline/revise';
import { runCritic } from '../pipeline/critic';
import { buildContextPack } from '../memory/retrieve';
import { randomUUID } from 'node:crypto';

const answersSchema = z.object({
  whatWorked: longText.default(''), whatDidnt: longText.default(''), changesRequested: longText.default(''), charactersOk: longText.default(''),
  dialogueNatural: longText.default(''), followedInstructions: longText.default(''), remove: longText.default(''), add: longText.default(''),
});
export const feedbackInputSchema = z.object({
  versionId: z.string().uuid(),
  rating: z.number().min(0).max(10).refine((r) => Number.isInteger(r * 2), 'Rating must be in 0.5 steps'),
  answers: answersSchema,
  approve: z.boolean().optional(),
});
type Proposal = typeof s.revisionProposals.$inferSelect & { items: RevisionItem[] };

export async function submitFeedback(ctx: AppContext, userId: string, input: z.input<typeof feedbackInputSchema>) {
  const data = parse(feedbackInputSchema, input);
  const { version, chapter } = await getVersionForUser(ctx.db, userId, data.versionId);
  await checkRateLimit(ctx.db, `ai:${userId}`, getEnv().AI_RATE_LIMIT_PER_MIN, 60);
  const chars = await ctx.db.select({ id: s.characters.id, name: s.characters.name, aliases: s.characters.aliases }).from(s.characters).where(eq(s.characters.novelId, chapter.novelId));
  const [feedback] = await ctx.db.insert(s.chapterFeedback).values({
    novelId: chapter.novelId, chapterId: chapter.id, chapterVersionId: version.id, rating: data.rating, ...data.answers, approvedAfter: data.approve ?? false,
  }).returning();
  const aInput = { answers: data.answers, rating: data.rating, chapterNumber: chapter.number, characters: chars };
  const res = await ctx.ai.analyzeText({ ...buildFeedbackPrompt(aInput), schema: feedbackAnalysisSchema as z.ZodType<FeedbackAnalysis>, task: { kind: 'feedback_analysis', input: aInput } });
  await recordUsage(ctx.db, { userId, novelId: chapter.novelId, operation: 'feedback_analysis' }, res);
  const valid = new Set(chars.map((c) => c.id));
  const clean = <T extends { characterId?: string; scope: string }>(x: T): T =>
    x.characterId && !valid.has(x.characterId) ? { ...x, characterId: undefined, scope: x.scope === 'character' ? 'chapter' : x.scope } : x;
  const analysis: FeedbackAnalysis = { ...res.value, items: res.value.items.map(clean).map((i) => ({ ...i, id: i.id || randomUUID(), status: 'pending' as const })), themes: res.value.themes.map(clean) };
  if (analysis.themes.length) await ctx.db.insert(s.feedbackThemes).values(analysis.themes.map((t) => ({
    novelId: chapter.novelId, feedbackId: feedback.id, chapterId: chapter.id, chapterNumber: chapter.number, themeKey: t.themeKey, scope: t.scope, characterId: t.characterId ?? null, statement: t.statement,
  })));
  const [proposal] = await ctx.db.insert(s.revisionProposals).values({ novelId: chapter.novelId, chapterId: chapter.id, baseVersionId: version.id, feedbackId: feedback.id, source: 'feedback', items: analysis.items }).returning();
  await afterFeedbackThemes(ctx.db, chapter.novelId, feedback.id, analysis.themes);
  return { feedback, proposal: proposal as Proposal, analysis };
}

export async function getProposal(db: DB, userId: string, proposalId: string): Promise<Proposal> {
  const rows = await db.select({ p: s.revisionProposals }).from(s.revisionProposals).innerJoin(s.novels, eq(s.novels.id, s.revisionProposals.novelId))
    .where(and(eq(s.revisionProposals.id, proposalId), eq(s.novels.ownerId, userId)));
  if (!rows[0]) throw new NotFoundError('Proposal');
  return rows[0].p as Proposal;
}

const updatesSchema = z.array(z.object({ id: z.string(), status: z.enum(['pending', 'accepted', 'rejected']).optional(), scope: scopeSchema.optional() })).max(200);
export async function updateProposalItems(db: DB, userId: string, proposalId: string, updates: z.input<typeof updatesSchema>) {
  const p = await getProposal(db, userId, proposalId);
  const ups = parse(updatesSchema, updates);
  const items = p.items.map((it) => { const u = ups.find((x) => x.id === it.id); return u ? { ...it, ...(u.status ? { status: u.status } : {}), ...(u.scope ? { scope: u.scope } : {}) } : it; });
  await db.update(s.revisionProposals).set({ items }).where(eq(s.revisionProposals.id, proposalId));
  if (p.feedbackId) {
    for (const u of ups.filter((x) => x.scope)) {
      const it = items.find((x) => x.id === u.id); if (!it) continue;
      await db.update(s.feedbackThemes).set({ scope: u.scope!, characterId: u.scope === 'character' ? it.characterId ?? null : null })
        .where(and(eq(s.feedbackThemes.feedbackId, p.feedbackId), eq(s.feedbackThemes.statement, it.target ?? it.change)));
    }
    const themes = await db.select().from(s.feedbackThemes).where(eq(s.feedbackThemes.feedbackId, p.feedbackId));
    await afterFeedbackThemes(db, p.novelId, p.feedbackId, themes.map((t) => ({ themeKey: t.themeKey, scope: t.scope, characterId: t.characterId ?? undefined, statement: t.statement })));
  }
  return { ...p, items };
}

export async function applyProposal(ctx: AppContext, userId: string, proposalId: string) {
  const p = await getProposal(ctx.db, userId, proposalId);
  const accepted = p.items.filter((i) => i.status === 'accepted');
  if (!accepted.length) throw new ValidationError('Accept at least one proposed change first.');
  const version = await reviseFromProposal(ctx, userId, p.baseVersionId, accepted, p.id);
  await ctx.db.update(s.revisionProposals).set({ resultingVersionId: version.id }).where(eq(s.revisionProposals.id, p.id));
  if (p.feedbackId) await ctx.db.update(s.chapterFeedback).set({ revisionVersionId: version.id }).where(eq(s.chapterFeedback.id, p.feedbackId));
  return version;
}

export async function proposeFromCritic(ctx: AppContext, userId: string, versionId: string) {
  const { version, chapter } = await getVersionForUser(ctx.db, userId, versionId);
  const pack = await buildContextPack(ctx, chapter);
  const report = runCritic(version.content, pack);
  const cont = ((version.continuityReport as { issues?: { category: string; message: string }[] } | null)?.issues ?? []);
  const tooLong = report.metrics.wordCount > report.metrics.targetWords;
  const toItem = (x: { category: string; message: string; characterId?: string }): RevisionItem => {
    const action = x.category === 'uniform_eloquence' ? 'dialogue_casual'
      : x.category === 'missing_required_event' ? 'add'
      : x.category === 'forbidden_event_present' ? 'remove'
      : x.category === 'pacing_length' ? (tooLong ? 'shorten_description' : 'expand_description')
      : ['canon_contradiction', 'dead_character_acts', 'location_jump'].includes(x.category) ? 'fix_continuity' : 'rewrite';
    const target = x.category === 'missing_required_event' ? x.message.match(/“(.+)”/)?.[1] : undefined;
    return { id: randomUUID(), change: x.message, rationale: `Critic: ${x.category.replaceAll('_', ' ')}`, action, target, characterId: x.characterId, scope: 'chapter', status: 'pending' };
  };
  const items = [...cont, ...report.issues].filter((x) => x.category !== 'new_entity').map(toItem);
  const [proposal] = await ctx.db.insert(s.revisionProposals).values({ novelId: chapter.novelId, chapterId: chapter.id, baseVersionId: version.id, source: 'critic', items }).returning();
  return proposal as Proposal;
}

export async function listFeedback(db: DB, userId: string, chapterId: string) {
  await getChapterForUser(db, userId, chapterId);
  return db.select().from(s.chapterFeedback).where(eq(s.chapterFeedback.chapterId, chapterId)).orderBy(asc(s.chapterFeedback.createdAt));
}

export async function ratingHistory(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  const chs = await db.select().from(s.chapters).where(eq(s.chapters.novelId, novelId)).orderBy(asc(s.chapters.number));
  const fb = chs.length ? await db.select({ f: s.chapterFeedback, vn: s.chapterVersions.versionNumber }).from(s.chapterFeedback)
    .innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.chapterFeedback.chapterVersionId))
    .where(inArray(s.chapterFeedback.chapterId, chs.map((c) => c.id))).orderBy(asc(s.chapterFeedback.createdAt)) : [];
  return chs.map((c) => {
    const mine = fb.filter((x) => x.f.chapterId === c.id);
    const approved = mine.filter((x) => x.f.chapterVersionId === c.approvedVersionId).at(-1);
    return { chapterId: c.id, chapterNumber: c.number, title: c.title, versions: mine.map((x) => ({ versionNumber: x.vn, rating: x.f.rating, createdAt: x.f.createdAt })), approvedRating: approved?.f.rating ?? null };
  });
}
