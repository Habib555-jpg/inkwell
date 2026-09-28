import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/server/db/schema';
import { runMigrations } from '@/server/db/migrate';
import type { DB } from '@/server/db/types';
import { createProviders } from '@/server/ai/registry';
import { loadEnv } from '@/server/env';
import type { AppContext } from '@/server/context';

/** Fresh in-memory Postgres with pgvector + all migrations. ~3s; create once per test file. */
export async function createTestDb(): Promise<DB> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema }) as unknown as DB;
  await runMigrations(db, 'pglite');
  return db;
}

/** In-memory DB + the keyless local providers — the same wiring the app uses by default. */
export async function createTestContext(): Promise<AppContext> {
  return { db: await createTestDb(), ...createProviders(loadEnv({})) };
}
