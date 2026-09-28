import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { AppContext } from '../context';
import type { Chapter } from '../services/access';
import { getVersionForUser } from '../services/access';
import type { ContextPack } from '../memory/types';
import type { Issue } from '../ai/types';
import { buildContextPack, searchCanon } from '../memory/retrieve';
import { ruleContinuity } from './continuity';
import { characterStateBefore, withStateAt } from '../memory/point-in-time';
import { runCritic, type CriticReport } from './critic';
import { issuesSchema } from '../ai/schemas';
import { buildContinuityPrompt, buildCriticPrompt } from '../ai/prompts/analysis';
import { recordUsage } from '../ai/usage';
import { log } from '../log';

export interface ContinuityReport { issues: Issue[]; checkedAt: string; provider: string; aiReviewed: boolean }

export async function runDraftChecks(ctx: AppContext, chapter: Chapter, pack: ContextPack, text: string, userId: string): Promise<{ continuity: ContinuityReport; critic: CriticReport }> {
  // continuity is judged against the story as it stood before this chapter
  const chars = withStateAt(await ctx.db.select().from(s.characters).where(eq(s.characters.novelId, chapter.novelId)), await characterStateBefore(ctx.db, chapter.novelId, chapter.number));
  const locs = await ctx.db.select().from(s.locations).where(eq(s.locations.novelId, chapter.novelId));
  const others = await Promise.all([s.factions, s.storyObjects, s.worldRules].map((t) => ctx.db.select({ name: (t as typeof s.factions).name }).from(t as typeof s.factions).where(eq((t as typeof s.factions).novelId, chapter.novelId))));
  const locName = (id: string | null) => locs.find((l) => l.id === id)?.name ?? null;
  const knownNames = [...chars.flatMap((c) => [c.name, ...c.aliases, c.name.split(' ')[0]]), ...locs.map((l) => l.name), ...others.flat().map((o) => o.name)];
  const issues = await ruleContinuity({
    draft: text, pack, knownNames, locationNames: locs.map((l) => l.name),
    characters: chars.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases, currentStatus: c.currentStatus, currentLocation: locName(c.currentLocationId) })),
    canonSearch: (q) => searchCanon(ctx, chapter.novelId, q, { beforeChapter: chapter.number, limit: 3 }),
  });
  const critic = runCritic(text, pack);
  let aiReviewed = false;
  if (ctx.ai.id !== 'local') {
    for (const [kind, prompt, sink] of [['continuity_review', buildContinuityPrompt(pack, text), issues], ['critic_review', buildCriticPrompt(pack, text), critic.issues]] as const) {
      try {
        const r = await ctx.ai.analyzeText({ ...prompt, schema: issuesSchema, task: { kind, draft: text, pack } as never, tier: 'fast' });
        await recordUsage(ctx.db, { userId, novelId: chapter.novelId, operation: kind }, r);
        sink.push(...r.value.issues.map((x) => ({ ...x, message: `AI: ${x.message}` })));
        aiReviewed = true;
      } catch (e) {
        log.warn('ai review failed', { kind, err: String(e) });
        sink.push({ severity: 'info', category: 'review_unavailable', message: 'AI review was unavailable; rule-based checks still ran.' });
      }
    }
  }
  return { continuity: { issues, checkedAt: new Date().toISOString(), provider: ctx.ai.id, aiReviewed }, critic };
}

export async function checkVersion(ctx: AppContext, userId: string, versionId: string) {
  const { version, chapter } = await getVersionForUser(ctx.db, userId, versionId);
  const pack = await buildContextPack(ctx, chapter);
  const r = await runDraftChecks(ctx, chapter, pack, version.content, userId);
  await ctx.db.update(s.chapterVersions).set({ continuityReport: r.continuity, criticReport: r.critic }).where(eq(s.chapterVersions.id, versionId));
  return r;
}
