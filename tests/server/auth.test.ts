import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from '../helpers/db';
import { registerUser, authenticate, createSession, getUserBySessionToken, deleteSession } from '@/server/auth/service';
import { ConflictError, ValidationError } from '@/server/errors';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/types';

let db: DB;
beforeAll(async () => { db = await createTestDb(); });

describe('auth', () => {
  it('registers with a hashed password and normalized email', async () => {
    const u = await registerUser(db, { email: '  Writer@Example.com ', password: 'correct horse', name: 'W' });
    expect(u.email).toBe('writer@example.com');
    const [row] = await db.select().from(s.users);
    expect(row.passwordHash).not.toContain('correct horse');
  });
  it('rejects duplicate emails', async () => {
    await registerUser(db, { email: 'dup@x.io', password: 'password1' });
    await expect(registerUser(db, { email: 'DUP@x.io', password: 'password1' })).rejects.toBeInstanceOf(ConflictError);
  });
  it('rejects short passwords', async () => {
    await expect(registerUser(db, { email: 's@x.io', password: 'short' })).rejects.toBeInstanceOf(ValidationError);
  });
  it('authenticates only with the right password', async () => {
    await registerUser(db, { email: 'login@x.io', password: 'password1' });
    expect(await authenticate(db, { email: 'login@x.io', password: 'password1' })).toMatchObject({ email: 'login@x.io' });
    expect(await authenticate(db, { email: 'login@x.io', password: 'wrong-pass' })).toBeNull();
    expect(await authenticate(db, { email: 'nobody@x.io', password: 'password1' })).toBeNull();
  });
  it('creates sessions stored only as hashes, resolves and deletes them', async () => {
    const u = await registerUser(db, { email: 'sess@x.io', password: 'password1' });
    const { token } = await createSession(db, u.id);
    const rows = await db.select().from(s.sessions);
    expect(rows.some((r) => r.id === token)).toBe(false);
    expect((await getUserBySessionToken(db, token))?.id).toBe(u.id);
    await deleteSession(db, token);
    expect(await getUserBySessionToken(db, token)).toBeNull();
  });
  it('ignores expired sessions', async () => {
    const u = await registerUser(db, { email: 'exp@x.io', password: 'password1' });
    const { token } = await createSession(db, u.id, new Date(Date.now() - 1000));
    expect(await getUserBySessionToken(db, token)).toBeNull();
  });
});
