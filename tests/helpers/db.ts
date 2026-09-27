import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/server/db/schema';
import { runMigrations } from '@/server/db/migrate';
import type { DB } from '@/server/db/types';

/** Fresh in-memory Postgres with pgvector + all migrations. ~3s; create once per test file. */
export async function createTestDb(): Promise<DB> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema }) as unknown as DB;
  await runMigrations(db, 'pglite');
  return db;
}
