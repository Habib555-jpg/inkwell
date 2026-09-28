'use server';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { authenticate, createSession, registerUser, deleteSession } from '@/server/auth/service';
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from '@/server/auth/session';
import { checkRateLimit } from '@/server/security/rate-limit';
import { cookies, headers } from 'next/headers';
import { clientIp } from '@/server/security/client-ip';
import { runAction, type ActionResult } from '../_actions/result';
import { UnauthorizedError } from '@/server/errors';

export async function loginAction(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const r = await runAction(async () => {
    const db = await getDb();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    await checkRateLimit(db, `login-ip:${clientIp(await headers())}`, 10, 60); // spec §13: 10/min per IP
    await checkRateLimit(db, `login:${email}`, 10, 60);
    const user = await authenticate(db, { email, password: String(form.get('password') ?? '') });
    if (!user) throw new UnauthorizedError('Email or password is incorrect');
    const { token, expiresAt } = await createSession(db, user.id);
    await setSessionCookie(token, expiresAt);
    return null;
  });
  if (r.ok) redirect('/');
  return r;
}
export async function registerAction(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const r = await runAction(async () => {
    const db = await getDb();
    const email = String(form.get('email') ?? '');
    await checkRateLimit(db, `register-ip:${clientIp(await headers())}`, 10, 60);
    await checkRateLimit(db, `register:${email.toLowerCase()}`, 10, 60);
    const user = await registerUser(db, { email, password: String(form.get('password') ?? ''), name: String(form.get('name') ?? '') });
    const { token, expiresAt } = await createSession(db, user.id);
    await setSessionCookie(token, expiresAt);
    return null;
  });
  if (r.ok) redirect('/novels');
  return r;
}
export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  await clearSessionCookie();
  redirect('/login');
}
