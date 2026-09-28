import { and, asc, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { AppContext } from '../context';
import { assertNovelOwner, getChapterForUser, type Chapter } from '../services/access';
import { NotFoundError, ValidationError } from '../errors';
import { parse, longText } from '../validation';
import { buildContextPack } from '../memory/retrieve';
import { generateDraft } from '../pipeline/generate';
import { checkVersion } from '../pipeline/checks';
import { buildAssistantPrompt } from '../ai/prompts/assistant';
import { buildFeedbackPrompt } from '../ai/prompts/feedback';
import { feedbackAnalysisSchema } from '../ai/schemas';
import { recordUsage } from '../ai/usage';
import { checkRateLimit } from '../security/rate-limit';
import { getEnv } from '../env';
import type { AssistantMode, FeedbackAnalysis, Issue } from '../ai/types';

const inputSchema = z.object({
  novelId: z.string().uuid(), chapterId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(),
  mode: z.enum(['generate', 'revise', 'continuity', 'brainstorm', 'character', 'story_memory', 'critic']), message: longText.min(1),
});
const fmtIssues = (xs: Issue[]) => xs.map((i) => `- [${i.severity}] ${i.message}${i.evidence?.quote ? `\n  Canon (ch ${i.evidence.chapterNumber}): “${i.evidence.quote}”` : ''}${i.evidence?.draftQuote ? `\n  Draft: “${i.evidence.draftQuote}”` : ''}`).join('\n');

export async function runAssistant(ctx: AppContext, userId: string, raw: z.input<typeof inputSchema>) {
  const input = parse(inputSchema, raw);
  await assertNovelOwner(ctx.db, userId, input.novelId);
  const chapter = input.chapterId ? await getChapterForUser(ctx.db, userId, input.chapterId) : null;
  if (chapter && chapter.novelId !== input.novelId) throw new NotFoundError('Chapter');
  const needsChapter: AssistantMode[] = ['generate', 'revise', 'continuity', 'critic'];
  if (needsChapter.includes(input.mode) && !chapter) throw new ValidationError('Open a chapter to use this mode.');
  await checkRateLimit(ctx.db, `ai:${userId}`, getEnv().AI_RATE_LIMIT_PER_MIN, 60);

  let conversationId = input.conversationId;
  if (conversationId) {
    const [c] = await ctx.db.select().from(s.aiConversations).where(and(eq(s.aiConversations.id, conversationId), eq(s.aiConversations.novelId, input.novelId)));
    if (!c) throw new NotFoundError('Conversation');
  } else {
    [{ id: conversationId }] = await ctx.db.insert(s.aiConversations).values({ novelId: input.novelId, chapterId: chapter?.id ?? null, mode: input.mode, title: input.message.slice(0, 80) }).returning({ id: s.aiConversations.id });
  }
  await ctx.db.insert(s.aiMessages).values({ conversationId, role: 'user', content: input.message, meta: { mode: input.mode } });

  let reply = ''; const meta: Record<string, unknown> = { mode: input.mode };
  const currentText = async (c: Chapter) => {
    if (!c.currentVersionId) throw new ValidationError('This chapter has no draft yet.');
    const [v] = await ctx.db.select().from(s.chapterVersions).where(eq(s.chapterVersions.id, c.currentVersionId)); return v;
  };
  switch (input.mode) {
    case 'generate': {
      const { version, pack } = await generateDraft(ctx, userId, chapter!.id);
      const issues = (version.continuityReport as { issues: Issue[] }).issues;
      reply = `Created v${version.versionNumber} using ${pack.included.length} memory items (${pack.budget.used}/${pack.budget.limit} tokens). ${issues.length} continuity finding(s). Review it in the editor.`;
      meta.versionId = version.id; break;
    }
    case 'revise': {
      const v = await currentText(chapter!);
      const chars = await ctx.db.select({ id: s.characters.id, name: s.characters.name, aliases: s.characters.aliases }).from(s.characters).where(eq(s.characters.novelId, input.novelId));
      const aIn = { answers: { whatWorked: '', whatDidnt: '', changesRequested: input.message, charactersOk: '', dialogueNatural: '', followedInstructions: '', remove: '', add: '' }, rating: 0, chapterNumber: chapter!.number, characters: chars };
      const r = await ctx.ai.analyzeText({ ...buildFeedbackPrompt(aIn), schema: feedbackAnalysisSchema as z.ZodType<FeedbackAnalysis>, task: { kind: 'feedback_analysis', input: aIn } });
      await recordUsage(ctx.db, { userId, novelId: input.novelId, operation: 'assistant_revise' }, r);
      const items = r.value.items.map((i) => ({ ...i, id: i.id || randomUUID(), status: 'pending' as const }));
      const [p] = await ctx.db.insert(s.revisionProposals).values({ novelId: input.novelId, chapterId: chapter!.id, baseVersionId: v.id, source: 'feedback', items }).returning();
      reply = items.length ? `Proposed changes to v${v.versionNumber}:\n${items.map((i, n) => `${n + 1}. ${i.change}`).join('\n')}\n\nReview and accept them in the Feedback tab.` : 'I could not turn that into concrete changes. Try naming what to add, remove, or change.';
      meta.proposalId = p.id; break;
    }
    case 'continuity': case 'critic': {
      const v = await currentText(chapter!);
      const r = await checkVersion(ctx, userId, v.id);
      reply = input.mode === 'continuity'
        ? (r.continuity.issues.length ? `Continuity findings for v${v.versionNumber}:\n${fmtIssues(r.continuity.issues)}` : 'No contradictions found by the rule checks (required/forbidden events, dead characters, locations, canon statements, new names).')
        : `${r.critic.summary}\n\n${fmtIssues(r.critic.issues)}\n\nMetrics: ${r.critic.metrics.wordCount}/${r.critic.metrics.targetWords} words · dialogue ${Math.round(r.critic.metrics.dialogueRatio * 100)}% · avg sentence ${r.critic.metrics.avgSentenceLength.toFixed(1)} words.`;
      meta.versionId = v.id; break;
    }
    default: {
      let target = chapter;
      if (!target) {
        const [{ m }] = await ctx.db.select({ m: max(s.chapters.number) }).from(s.chapters).where(eq(s.chapters.novelId, input.novelId));
        const [any] = await ctx.db.select().from(s.chapters).where(eq(s.chapters.novelId, input.novelId)).orderBy(desc(s.chapters.number)).limit(1);
        target = { ...(any ?? ({} as Chapter)), id: any?.id ?? randomUUID(), novelId: input.novelId, number: (m ?? 0) + 1, title: '', mainIdea: input.message, requiredEvents: [], forbiddenEvents: [], characterIds: [], dialoguePoints: [], tone: '', restrictions: '', instructions: '', targetWords: null } as Chapter;
      }
      const pack = await buildContextPack(ctx, target);
      const draft = chapter?.currentVersionId ? (await currentText(chapter)).content : null;
      const r = await ctx.ai.generateText({ ...buildAssistantPrompt(input.mode, pack, input.message, draft), task: { kind: 'assistant', mode: input.mode, pack, message: input.message, draft }, tier: input.mode === 'story_memory' ? 'fast' : 'main' });
      await recordUsage(ctx.db, { userId, novelId: input.novelId, operation: `assistant_${input.mode}` }, r);
      reply = r.value;
    }
  }
  await ctx.db.insert(s.aiMessages).values({ conversationId, role: 'assistant', content: reply, meta });
  await ctx.db.update(s.aiConversations).set({ updatedAt: new Date() }).where(eq(s.aiConversations.id, conversationId));
  return { conversationId: conversationId!, reply, meta };
}

export async function listConversation(db: DB, userId: string, conversationId: string) {
  const rows = await db.select({ c: s.aiConversations }).from(s.aiConversations).innerJoin(s.novels, eq(s.novels.id, s.aiConversations.novelId))
    .where(and(eq(s.aiConversations.id, conversationId), eq(s.novels.ownerId, userId)));
  if (!rows[0]) throw new NotFoundError('Conversation');
  return db.select().from(s.aiMessages).where(eq(s.aiMessages.conversationId, conversationId)).orderBy(asc(s.aiMessages.createdAt));
}
