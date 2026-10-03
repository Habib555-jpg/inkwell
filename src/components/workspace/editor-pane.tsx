'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check, CloudOff, Feather, Loader2, OctagonAlert, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAutosave, type Flushed, type SaveState } from './use-autosave';
import { cn } from '@/lib/cn';

const STATE: Record<SaveState, { label: string; icon: React.ReactNode; tone: string }> = {
  saved: { label: 'Saved', icon: <Check className="size-3.5" aria-hidden />, tone: 'text-canon' },
  dirty: { label: 'Unsaved changes', icon: <PencilLine className="size-3.5" aria-hidden />, tone: 'text-draft' },
  saving: { label: 'Saving…', icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, tone: 'text-ink-soft' },
  retrying: { label: 'Offline — retrying', icon: <CloudOff className="size-3.5" aria-hidden />, tone: 'text-changed' },
  error: { label: 'Not saved', icon: <OctagonAlert className="size-3.5" aria-hidden />, tone: 'text-changed' },
};

/** Manuscript editor with autosave. Rendered client-only (see chapter-workspace), so it may read localStorage on first render. */
export default function EditorPane({ chapterId, versionId, versionNumber, initialContent, readOnly, targetWords, onForked, apiRef }: {
  chapterId: string; versionId: string; versionNumber: number; initialContent: string; readOnly: boolean; targetWords: number;
  onForked: () => void; apiRef: React.RefObject<{ flush: () => Promise<Flushed> } | null>;
}) {
  const handleFork = useCallback((v: { versionId: string; versionNumber: number }) => {
    toast.info(`You're now editing v${v.versionNumber}. v${versionNumber} is unchanged.`);
    onForked();
  }, [onForked, versionNumber]);
  const { state, error, savedAt, change, flush, recover } = useAutosave(chapterId, versionId, handleFork);
  useEffect(() => { apiRef.current = { flush }; return () => { apiRef.current = null; }; }, [apiRef, flush]);
  const [text, setText] = useState(initialContent);
  const [recovered, setRecovered] = useState<string | null>(() => recover(initialContent));
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const s = STATE[state];
  const progress = Math.min(1, words / Math.max(1, targetWords));

  const onChange = (v: string) => { setText(v); change(v); };
  return (
    <div className="manuscript-page glass relative overflow-hidden rounded-[var(--radius-card)] border border-line shadow-card">
      {/* hairline of gold leaf along the top edge, and the page header */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <div className="flex items-center gap-2 border-b border-line/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        <Feather className="size-3.5 text-gold" aria-hidden />Manuscript<span className="text-ink-faint/70">· v{versionNumber}</span>
      </div>
      <AnimatePresence>
        {recovered !== null && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap items-center gap-3 border-b border-line bg-draft-soft px-4 py-3 text-sm text-draft" role="status">
            <AlertCircle className="size-4" aria-hidden />
            <span className="flex-1">Unsaved text from your last session was found for this version.</span>
            <button className="cursor-pointer font-semibold underline" onClick={() => { onChange(recovered); setRecovered(null); }}>Restore it</button>
            <button className="cursor-pointer" onClick={() => setRecovered(null)}>Discard</button>
          </motion.div>
        )}
      </AnimatePresence>
      <label htmlFor="manuscript" className="sr-only">Chapter text</label>
      <textarea
        id="manuscript"
        value={text}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        spellCheck
        placeholder="Generate a draft, or start writing — every edit is saved as you go."
        className={cn('manuscript mx-auto block min-h-[65vh] w-full max-w-[72ch] resize-y bg-transparent px-6 py-8 text-ink outline-none placeholder:italic placeholder:text-ink-faint sm:px-10',
          readOnly && 'cursor-progress opacity-70')}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-5 py-2.5 text-xs text-ink-faint">
        <span className="flex items-center gap-3">
          <span className="tabular-nums">{words.toLocaleString()} / {targetWords.toLocaleString()} words</span>
          <span className="h-1 w-28 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Progress toward target length" aria-valuemin={0} aria-valuemax={targetWords} aria-valuenow={words}>
            <span className="block h-full rounded-full bg-gradient-to-r from-gold via-accent to-ember transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
          </span>
        </span>
        <span className={cn('inline-flex items-center gap-1.5', s.tone)} aria-live="polite">
          {s.icon}{s.label}{state === 'error' && error ? ` — ${error} Your text is kept on this device.` : ''}{state === 'saved' && savedAt ? ` · ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      </div>
    </div>
  );
}
