import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { AIResult } from './types';
import { log } from '../log';

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
export async function recordUsage(db: DB, ctx: { userId: string; novelId?: string | null; operation: string }, r: AIResult<unknown>) {
  try {
    await db.insert(s.aiUsage).values({
      userId: ctx.userId, novelId: ctx.novelId ?? null, operation: ctx.operation, provider: r.provider, model: r.model,
      inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, estimated: r.usage.estimated,
    });
  } catch (e) { log.warn('usage record failed', { err: String(e) }); } // never fail the user's action over accounting
}
