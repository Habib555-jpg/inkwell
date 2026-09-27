import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '../helpers/db';
import { checkRateLimit } from '@/server/security/rate-limit';
import { RateLimitError } from '@/server/errors';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('checkRateLimit', () => {
  it('allows up to the limit then throws', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(db, 'k1', 3, 60);
    await expect(checkRateLimit(db, 'k1', 3, 60)).rejects.toBeInstanceOf(RateLimitError);
  });
  it('keys are independent', async () => {
    await checkRateLimit(db, 'k2', 1, 60);
    await expect(checkRateLimit(db, 'k3', 1, 60)).resolves.toBeUndefined();
  });
  it('resets after the window', async () => {
    await checkRateLimit(db, 'k4', 1, 60, new Date(Date.now() - 120_000));
    await expect(checkRateLimit(db, 'k4', 1, 60)).resolves.toBeUndefined();
  });
});
