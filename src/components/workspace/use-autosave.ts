'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { autosaveAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'retrying';
const key = (id: string) => `wn:unsaved:${id}`;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} }, del: (k: string) => { try { localStorage.removeItem(k); } catch {} } };

/** Remounted per version (the editor is keyed by version id). */
export function useAutosave(initialVersionId: string | null, onFork: (v: { versionId: string; versionNumber: number }) => void) {
  const [versionId, setVersionId] = useState(initialVersionId);
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attempt = useRef(0);
  const flushRef = useRef<() => void>(() => {}); // lets the retry timer call the latest flush

  const flush = useCallback(async () => {
    if (!versionId || pending.current === null) return;
    const text = pending.current; setState('saving');
    const r = await autosaveAction(versionId, text);
    if (r.ok) {
      if (pending.current === text) pending.current = null;
      store.del(key(versionId)); attempt.current = 0; setSavedAt(new Date(r.data.savedAt));
      if (r.data.forked) { setVersionId(r.data.versionId); onFork(r.data); }
      setState(pending.current === null ? 'saved' : 'dirty');
    } else {
      setState('retrying'); attempt.current++;
      timer.current = setTimeout(() => flushRef.current(), Math.min(30_000, 1000 * 2 ** attempt.current));
    }
  }, [versionId, onFork]);

  useEffect(() => { flushRef.current = () => void flush(); }, [flush]);

  const change = useCallback((text: string) => {
    pending.current = text; setState('dirty');
    if (versionId) store.set(key(versionId), text);
    clearTimeout(timer.current); timer.current = setTimeout(() => flushRef.current(), 1500);
  }, [versionId]);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (pending.current !== null) { e.preventDefault(); } };
    window.addEventListener('beforeunload', guard);
    return () => { window.removeEventListener('beforeunload', guard); clearTimeout(timer.current); void flush(); };
  }, [flush]);

  const recover = useCallback((serverText: string) => {
    const local = versionId ? store.get(key(versionId)) : null;
    return local && local !== serverText ? local : null;
  }, [versionId]);
  return { versionId, state, savedAt, change, flush, recover };
}
