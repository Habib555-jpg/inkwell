import 'server-only';
import { notFound } from 'next/navigation';
import { isAppError } from '../errors';

/** Runs an owner-scoped loader and turns NotFoundError into a 404 page (no existence leak). */
export async function orNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) { if (isAppError(e) && e.code === 'not_found') notFound(); throw e; }
}
