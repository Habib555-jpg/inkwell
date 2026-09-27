import 'server-only';
import { getEnv } from '../env';
import { createDb } from './connect';
import type { DB } from './types';

const g = globalThis as unknown as { __wnDb?: Promise<DB> };

/** Memoized across hot reloads so dev doesn't open the PGlite dir twice. */
export function getDb(): Promise<DB> {
  return (g.__wnDb ??= createDb(getEnv()));
}
