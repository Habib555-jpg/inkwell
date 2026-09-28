'use client';
import { useState, useTransition } from 'react';
import { CheckCircle2, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { compareAction, deleteVersionAction, restoreAction, setCurrentAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import { DiffView } from './diff-view';
import type { WsVersionSummary } from './types';
import type { DiffPart } from '@/lib/diff';

const SOURCE: Record<WsVersionSummary['source'], string> = { generated: 'Generated', revised: 'Revised', manual: 'Your edits', restored: 'Restored' };

export function VersionsPanel({ versions, currentId, approvedId, onChanged }: { versions: WsVersionSummary[]; currentId: string | null; approvedId: string | null; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [diff, setDiff] = useState<{ a: number; b: number; diff: DiffPart[] } | null>(null);
  const [toDelete, setToDelete] = useState<WsVersionSummary | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => start(async () => {
    const r = await fn(); if (!r.ok) toast.error(r.error ?? 'Failed'); else { if (done) toast.success(done); onChanged(); }
  });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  const compare = () => start(async () => {
    const [x, y] = [...picked].sort((i, j) => versions.find((v) => v.id === i)!.versionNumber - versions.find((v) => v.id === j)!.versionNumber);
    const r = await compareAction(x, y);
    if (r.ok) setDiff({ a: r.data.a.versionNumber, b: r.data.b.versionNumber, diff: r.data.diff }); else toast.error(r.error);
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">Every draft is kept. Select two to compare.</p>
        <Button size="sm" variant="secondary" disabled={picked.length !== 2 || pending} onClick={compare} icon={<GitCompare className="size-4" aria-hidden />}>Compare</Button>
      </div>
      <ul className="space-y-2">
        {versions.map((v) => {
          const canon = v.id === approvedId, current = v.id === currentId;
          return (
            <li key={v.id} className={cn('rounded-xl border p-3 transition-colors', canon ? 'border-canon/40 bg-canon-soft/40' : current ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-surface')}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" aria-label={`Select v${v.versionNumber} for comparison`} checked={picked.includes(v.id)} onChange={() => toggle(v.id)} className="size-4 cursor-pointer" />
                <span className="font-semibold tabular-nums">v{v.versionNumber}</span>
                {canon && <Badge tone="canon" icon={<CheckCircle2 className="size-3" aria-hidden />}>Canon</Badge>}
                {current && !canon && <Badge tone="accent">Current</Badge>}
                <Badge>{SOURCE[v.source]}</Badge>
                <span className="ml-auto text-xs text-ink-faint">{v.wordCount.toLocaleString()} words · {new Date(v.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {!current && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setCurrentAction(v.id))}>Open</Button>}
                <Button size="sm" variant="ghost" disabled={pending} icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => run(() => restoreAction(v.id), `Restored v${v.versionNumber} as a new version`)}>Restore</Button>
                {!canon && !current && <Button size="sm" variant="ghost" className="text-changed" disabled={pending} icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setToDelete(v)}>Delete</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      {diff && <DiffView open onOpenChange={(o) => !o && setDiff(null)} a={diff.a} b={diff.b} diff={diff.diff} />}
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} danger loading={pending} title={`Delete v${toDelete?.versionNumber}?`} confirmLabel="Delete version"
        body="This draft will be hidden from the history. Canon and the current version can never be deleted."
        onConfirm={() => { const v = toDelete!; setToDelete(null); run(() => deleteVersionAction(v.id), `Deleted v${v.versionNumber}`); }} />
    </div>
  );
}
