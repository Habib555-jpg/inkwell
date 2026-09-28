'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { autosaveAction, saveAsNewVersionAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import { nextAutosaveStep } from '@/lib/autosave-policy';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'retrying' | 'error';
export type Flushed = { versionId: string | null; savedAt: string | null };
const key = (id: string) => `wn:unsaved:${id}`;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

/**
 * Debounced autosave that never loses writing: unsent text is backed up locally, transient failures retry with
 * backoff, a vanished/uneditable version falls back to saving a new manual version, and validation/sign-out
 * errors stop and tell the writer. Remounted per version (the editor is keyed by version id).
 */
export function useAutosave(chapterId: string, initialVersionId: string | null, onFork: (v: { versionId: string; versionNumber: number }) => void) {
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const vid = useRef(initialVersionId);
  const lastSavedAt = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const inFlight = useRef<Promise<Flushed> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attempt = useRef(0);
  const flushRef = useRef<() => Promise<Flushed>>(async () => ({ versionId: vid.current, savedAt: lastSavedAt.current }));

  const moveTo = useCallback((v: { versionId: string; versionNumber: number }, text: string) => {
    if (vid.current) store.del(key(vid.current));
    vid.current = v.versionId;
    if (pending.current !== null && pending.current !== text) store.set(key(v.versionId), pending.current);
    onFork(v);
  }, [onFork]);

  const saveOnce = useCallback(async (): Promise<Flushed> => {
    const id = vid.current;
    if (!id || pending.current === null) return { versionId: id, savedAt: lastSavedAt.current };
    const text = pending.current; setState('saving');
    let r = await autosaveAction(id, text);
    if (!r.ok && nextAutosaveStep(r.code) === 'save_as_new_version') {
      const alt = await saveAsNewVersionAction(chapterId, text);
      if (alt.ok) r = { ok: true, data: { ...alt.data, forked: true, wordCount: 0 } };
    }
    if (r.ok) {
      if (pending.current === text) { pending.current = null; store.del(key(id)); }
      attempt.current = 0; lastSavedAt.current = r.data.savedAt; setSavedAt(new Date(r.data.savedAt)); setError(null);
      if (r.data.forked) moveTo(r.data, text);
      setState(pending.current === null ? 'saved' : 'dirty');
      return { versionId: vid.current, savedAt: r.data.savedAt };
    }
    if (nextAutosaveStep(r.code) === 'retry') {
      setState('retrying'); attempt.current++;
      timer.current = setTimeout(() => void flushRef.current(), Math.min(30_000, 1000 * 2 ** attempt.current));
    } else {
      setState('error'); setError(r.error); // text stays in the local backup; nothing is retried blindly
    }
    return { versionId: vid.current, savedAt: null };
  }, [chapterId, moveTo]);

  /** Saves any pending text (one save at a time) and returns the version the text now lives in. */
  const flush = useCallback(async (): Promise<Flushed> => {
    clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    if (pending.current === null) return { versionId: vid.current, savedAt: lastSavedAt.current };
    inFlight.current = saveOnce();
    try { return await inFlight.current; } finally { inFlight.current = null; }
  }, [saveOnce]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const change = useCallback((text: string) => {
    pending.current = text; setState('dirty');
    if (vid.current) store.set(key(vid.current), text);
    clearTimeout(timer.current); timer.current = setTimeout(() => void flushRef.current(), 1500);
  }, []);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (pending.current !== null) e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => { window.removeEventListener('beforeunload', guard); clearTimeout(timer.current); void flushRef.current(); };
  }, []);

  const recover = useCallback((serverText: string) => {
    const local = initialVersionId ? store.get(key(initialVersionId)) : null;
    return local && local !== serverText ? local : null;
  }, [initialVersionId]);
  return { state, error, savedAt, change, flush, recover };
}
