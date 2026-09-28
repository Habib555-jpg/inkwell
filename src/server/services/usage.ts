import { and, eq, gte, sql } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';

export async function getUsageSummary(db: DB, userId: string, since = new Date(Date.now() - 30 * 864e5)) {
  const rows = await db.select({
    operation: s.aiUsage.operation,
    input: sql<number>`coalesce(sum(${s.aiUsage.inputTokens}),0)::int`,
    output: sql<number>`coalesce(sum(${s.aiUsage.outputTokens}),0)::int`,
    calls: sql<number>`count(*)::int`,
    anyEstimated: sql<boolean>`bool_or(${s.aiUsage.estimated})`,
  }).from(s.aiUsage).where(and(eq(s.aiUsage.userId, userId), gte(s.aiUsage.createdAt, since))).groupBy(s.aiUsage.operation);
  return {
    totalInput: rows.reduce((a, r) => a + Number(r.input), 0),
    totalOutput: rows.reduce((a, r) => a + Number(r.output), 0),
    estimated: rows.some((r) => r.anyEstimated),
    byOperation: rows.map((r) => ({ operation: r.operation, input: Number(r.input), output: Number(r.output), calls: Number(r.calls) })),
  };
}
