import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { ConflictError, ValidationError } from '../errors';
import { hashPassword, verifyPassword } from './password';

export type PublicUser = { id: string; email: string; name: string };
const SESSION_DAYS = 30;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  name: z.string().trim().max(200).optional(),
});

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const pub = (u: typeof s.users.$inferSelect): PublicUser => ({ id: u.id, email: u.email, name: u.name });

export async function registerUser(db: DB, input: { email: string; password: string; name?: string }): Promise<PublicUser> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, parsed.error.issues);
  const { email, password, name } = parsed.data;
  const existing = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (existing.length) throw new ConflictError('An account with this email already exists');
  const [u] = await db.insert(s.users).values({ email, name: name ?? '', passwordHash: await hashPassword(password) }).returning();
  return pub(u);
}

export async function authenticate(db: DB, input: { email: string; password: string }): Promise<PublicUser | null> {
  const email = input.email.trim().toLowerCase();
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!u) { await verifyPassword(input.password, '$2a$04$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv'); return null; }
  return (await verifyPassword(input.password, u.passwordHash)) ? pub(u) : null;
}

export async function createSession(db: DB, userId: string, expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5)) {
  const token = randomBytes(32).toString('base64url');
  await db.insert(s.sessions).values({ id: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(db: DB, token: string): Promise<PublicUser | null> {
  if (!token) return null;
  const rows = await db.select({ u: s.users }).from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, sha256(token)), gt(s.sessions.expiresAt, new Date())));
  return rows[0] ? pub(rows[0].u) : null;
}

export async function deleteSession(db: DB, token: string) {
  await db.delete(s.sessions).where(eq(s.sessions.id, sha256(token)));
}
