import { isAppError } from '@/server/errors';
import { log } from '@/server/log';
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code: string };
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await fn() }; }
  catch (e) {
    if (isAppError(e)) return { ok: false, error: e.message, code: e.code };
    // Next.js redirect()/notFound() must propagate
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_')) throw e;
    log.error('action failed', { err: e instanceof Error ? e.stack : String(e) });
    return { ok: false, error: 'Something went wrong. Your work was not lost — please retry.', code: 'internal' };
  }
}
