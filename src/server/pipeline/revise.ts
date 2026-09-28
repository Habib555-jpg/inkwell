import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { AppContext } from '../context';
import { getVersionForUser } from '../services/access';
import { insertVersion } from '../services/versions';
import { buildContextPack } from '../memory/retrieve';
import { buildRevisionPrompt, promptHash } from '../ai/prompts/chapter';
import { recordUsage } from '../ai/usage';
import { checkRateLimit } from '../security/rate-limit';
import { getEnv } from '../env';
import { runDraftChecks } from './checks';
import { LOCAL_REVISION_ACTIONS } from '../ai/providers/local/draft';
import type { RevisionItem } from '../ai/types';

export async function reviseFromProposal(ctx: AppContext, userId: string, baseVersionId: string, items: RevisionItem[], proposalId: string) {
  const { version: base, chapter } = await getVersionForUser(ctx.db, userId, baseVersionId);
  await checkRateLimit(ctx.db, `ai:${userId}`, getEnv().AI_RATE_LIMIT_PER_MIN, 60);
  const pack = await buildContextPack(ctx, chapter);
  const prompt = buildRevisionPrompt(pack, base.content, items);
  const [settings] = await ctx.db.select({ aiModel: s.novelSettings.aiModel }).from(s.novelSettings).where(eq(s.novelSettings.novelId, chapter.novelId));
  const res = await ctx.ai.generateText({ ...prompt, task: { kind: 'chapter_revision', pack, baseText: base.content, items }, tier: 'main', model: settings?.aiModel ?? undefined });
  await recordUsage(ctx.db, { userId, novelId: chapter.novelId, operation: 'revise' }, res);
  const checks = await runDraftChecks(ctx, chapter, pack, res.value, userId);
  const notApplied = ctx.ai.id === 'local' ? items.filter((i) => !LOCAL_REVISION_ACTIONS.has(i.action)).map((i) => ({ id: i.id, change: i.change })) : [];
  return insertVersion(ctx.db, {
    chapter, content: res.value, source: 'revised', parentVersionId: base.id,
    generationMeta: { provider: res.provider, model: res.model, proposalId, appliedItems: items.map((i) => i.id), notApplied, included: pack.included, promptHash: promptHash(prompt), usage: res.usage },
    continuityReport: checks.continuity, criticReport: checks.critic,
  });
}
