import { sql } from 'drizzle-orm';
import path from 'node:path';
import type { DB } from './types';

export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

export async function runMigrations(db: DB, driver: 'pglite' | 'pg'): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  if (driver === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  }
}
