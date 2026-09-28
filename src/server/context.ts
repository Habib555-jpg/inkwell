import 'server-only';
import { getDb } from './db/client';
import { getEnv } from './env';
import { createProviders } from './ai/registry';
import type { DB } from './db/types';
import type { AIProvider, EmbeddingProvider } from './ai/types';

export interface AppContext { db: DB; ai: AIProvider; embedder: EmbeddingProvider }
const g = globalThis as unknown as { __wnProviders?: ReturnType<typeof createProviders> };
export async function getAppContext(): Promise<AppContext> {
  const db = await getDb();
  const p = (g.__wnProviders ??= createProviders(getEnv()));
  return { db, ...p };
}
export const getAppDb = getDb;
