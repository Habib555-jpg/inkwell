import { sql } from 'drizzle-orm';
import type { DB } from '../db/types';
import { RateLimitError } from '../errors';

/** Fixed-window limiter stored in Postgres (works across processes). `now` is injectable for tests. */
export async function checkRateLimit(db: DB, key: string, limit: number, windowSec: number, now = new Date()): Promise<void> {
  const res = await db.execute<{ count: number; window_start: string }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${now.toISOString()}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < ${now.toISOString()}::timestamptz - make_interval(secs => ${windowSec})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < ${now.toISOString()}::timestamptz - make_interval(secs => ${windowSec})
                   THEN ${now.toISOString()}::timestamptz ELSE rate_limits.window_start END
    RETURNING count, window_start`);
  const row = (res as unknown as { rows: { count: number; window_start: string }[] }).rows[0];
  if (Number(row.count) > limit) {
    const elapsed = (now.getTime() - new Date(row.window_start).getTime()) / 1000;
    throw new RateLimitError(Math.max(1, Math.ceil(windowSec - elapsed)));
  }
}
