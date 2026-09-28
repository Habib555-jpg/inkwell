import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { AppContext } from '../context';
import { getChapterForUser } from '../services/access';
import { insertVersion } from '../services/versions';
import { buildContextPack } from '../memory/retrieve';
import { buildDraftPrompt, promptHash } from '../ai/prompts/chapter';
import { recordUsage } from '../ai/usage';
import { checkRateLimit } from '../security/rate-limit';
import { getEnv } from '../env';
import { ValidationError } from '../errors';
import type { ContextPack } from '../memory/types';
import type { Chapter } from '../services/access';

/** Replaced in Task 15 by the real continuity + critic pass. */
export async function runDraftChecks(_ctx: AppContext, _chapter: Chapter, _pack: ContextPack, _text: string, _userId: string): Promise<{ continuity: unknown; critic: unknown }> {
  return { continuity: null, critic: null };
}

export async function generateDraft(ctx: AppContext, userId: string, chapterId: string) {
  const chapter = await getChapterForUser(ctx.db, userId, chapterId);
  if (!chapter.mainIdea.trim() && chapter.requiredEvents.length === 0)
    throw new ValidationError('Add a main idea or at least one required event before generating.');
  await checkRateLimit(ctx.db, `ai:${userId}`, getEnv().AI_RATE_LIMIT_PER_MIN, 60);
  const pack = await buildContextPack(ctx, chapter);
  const prompt = buildDraftPrompt(pack);
  const [settings] = await ctx.db.select({ aiModel: s.novelSettings.aiModel }).from(s.novelSettings).where(eq(s.novelSettings.novelId, chapter.novelId));
  const res = await ctx.ai.generateText({ ...prompt, task: { kind: 'chapter_draft', pack }, tier: 'main', model: settings?.aiModel ?? undefined });
  await recordUsage(ctx.db, { userId, novelId: chapter.novelId, operation: 'generate' }, res);
  const checks = await runDraftChecks(ctx, chapter, pack, res.value, userId);
  const version = await insertVersion(ctx.db, {
    chapter, content: res.value, source: 'generated', parentVersionId: chapter.currentVersionId,
    generationMeta: { provider: res.provider, model: res.model, included: pack.included, budget: pack.budget, promptHash: promptHash(prompt), usage: res.usage },
    continuityReport: checks.continuity, criticReport: checks.critic,
  });
  return { version, pack };
}
