import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '../db/client';
import { getUserBySessionToken, type PublicUser } from './service';
import { UnauthorizedError } from '../errors';

export const SESSION_COOKIE = 'wn_session';

export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(await getDb(), token);
});

export async function requireUser(): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}
/** For server actions: throw instead of redirect so the action returns a typed error. */
export async function requireUserForAction(): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt,
  });
}
export async function clearSessionCookie() { (await cookies()).delete(SESSION_COOKIE); }
