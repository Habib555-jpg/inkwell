import fs from 'node:fs';
import type { Env } from '../env';
import * as schema from './schema';
import { runMigrations } from './migrate';
import type { DB } from './types';

/** Opens Postgres (DATABASE_URL) or embedded PGlite and applies migrations when enabled. No Next.js imports: usable from CLIs. */
export async function createDb(env: Env): Promise<DB> {
  if (env.DATABASE_URL) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const db = drizzle(new Pool({ connectionString: env.DATABASE_URL, max: 10 }), { schema }) as unknown as DB;
    if (env.DB_AUTO_MIGRATE === 'true') await runMigrations(db, 'pg');
    return db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  const { drizzle } = await import('drizzle-orm/pglite');
  fs.mkdirSync(env.PGLITE_DIR, { recursive: true });
  const client = new PGlite(env.PGLITE_DIR, { extensions: { vector } });
  const db = drizzle(client, { schema }) as unknown as DB;
  if (env.DB_AUTO_MIGRATE === 'true') await runMigrations(db, 'pglite');
  return db;
}
