import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '../helpers/db';
import { makeUser } from '../helpers/fixtures';
import { recordUsage } from '@/server/ai/usage';
import { getUsageSummary } from '@/server/services/usage';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('usage tracking', () => {
  it('records and summarizes per user', async () => {
    const a = await makeUser(db); const b = await makeUser(db);
    const r = { value: 'x', usage: { inputTokens: 100, outputTokens: 50, estimated: true }, provider: 'local', model: 'local' };
    await recordUsage(db, { userId: a.id, operation: 'generate' }, r);
    await recordUsage(db, { userId: a.id, operation: 'generate' }, r);
    await recordUsage(db, { userId: a.id, operation: 'summarize' }, r);
    await recordUsage(db, { userId: b.id, operation: 'generate' }, r);
    const s = await getUsageSummary(db, a.id);
    expect(s.totalInput).toBe(300);
    expect(s.totalOutput).toBe(150);
    expect(s.estimated).toBe(true);
    expect(s.byOperation.find((o) => o.operation === 'generate')?.calls).toBe(2);
  });
});
