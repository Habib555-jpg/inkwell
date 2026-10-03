'use client';
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveConflictAction } from '@/app/(app)/novels/[novelId]/memory/actions';

export type ConflictRow = { id: string; kind: 'field' | 'relationship' | 'retracted_record'; entityType: string; entityName: string; field: string; existingValue: string; proposedValue: string; evidence: string; chapterNumber: number | null };

const FIELD: Record<string, string> = { currentStatus: 'status', currentLocationId: 'location', description: 'description', type: 'relationship', __record__: 'record' };
const proposed = (c: ConflictRow) => {
  if (c.kind === 'relationship') { try { return (JSON.parse(c.proposedValue) as { type: string }).type; } catch { return c.proposedValue; } }
  return c.kind === 'retracted_record' ? 'remove it' : c.proposedValue;
};

function Conflict({ c, novelId }: { c: ConflictRow; novelId: string }) {
  const [merged, setMerged] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pending, start] = useTransition();
  const decide = (d: 'keep_existing' | 'accept_new' | 'merge') => start(async () => {
    const r = await resolveConflictAction(novelId, c.id, d, d === 'merge' ? merged : undefined);
    if (r.ok) toast.success(d === 'keep_existing' ? 'Kept memory as it was' : 'Memory updated'); else toast.error(r.error);
  });
  const retracted = c.kind === 'retracted_record';
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
      className="glass rounded-[var(--radius-card)] border border-line p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{c.entityType.replace('_', ' ')} · {c.entityName} · {FIELD[c.field] ?? c.field}</p>
      {retracted ? (
        <p className="mt-2 text-sm">{c.evidence}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-sunken p-3"><p className="text-xs text-ink-faint">Memory says</p><p className="mt-1 font-medium">{c.existingValue || '—'}</p></div>
          <div className="rounded-xl border border-accent/30 bg-accent-soft p-3"><p className="text-xs text-accent">Chapter {c.chapterNumber ?? '?'} says</p><p className="mt-1 font-medium">{proposed(c)}</p></div>
        </div>
      )}
      {!retracted && c.evidence && <blockquote className="manuscript mt-3 border-l-2 border-accent pl-3 text-sm text-ink-soft">“{c.evidence}”</blockquote>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={pending} onClick={() => decide('keep_existing')}>{retracted ? 'Keep it' : 'Keep memory'}</Button>
        <Button size="sm" loading={pending} onClick={() => decide('accept_new')}>{retracted ? 'Remove it' : `Use chapter ${c.chapterNumber ?? ''}`}</Button>
        {!retracted && <Button size="sm" variant="ghost" onClick={() => setMergeOpen(!mergeOpen)}>Write merged value</Button>}
      </div>
      {mergeOpen && (
        <form onSubmit={(e) => { e.preventDefault(); decide('merge'); }} className="mt-3 flex gap-2">
          <Input aria-label="Merged value" value={merged} onChange={(e) => setMerged(e.target.value)} placeholder="The value that is actually true" required />
          <Button type="submit" size="md" loading={pending}>Save</Button>
        </form>
      )}
    </motion.li>
  );
}

export function ConflictsList({ conflicts, novelId }: { conflicts: ConflictRow[]; novelId: string }) {
  if (!conflicts.length) return <EmptyState icon={<CheckCircle2 className="size-5" />} title="No conflicts">Memory agrees with canon. When an approved chapter disagrees with what is remembered, you&apos;ll decide here.</EmptyState>;
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-sm text-ink-soft"><Scale className="size-4" aria-hidden />Nothing here was changed automatically. Choose what is true.</p>
      <ul className="space-y-3"><AnimatePresence>{conflicts.map((c) => <Conflict key={c.id} c={c} novelId={novelId} />)}</AnimatePresence></ul>
    </div>
  );
}
