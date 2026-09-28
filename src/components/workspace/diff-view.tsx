'use client';
import { Dialog } from '@/components/ui/dialog';
import type { DiffPart } from '@/lib/diff';

export function DiffView({ open, onOpenChange, a, b, diff }: { open: boolean; onOpenChange: (o: boolean) => void; a: number; b: number; diff: DiffPart[] }) {
  const added = diff.filter((p) => p.added).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0);
  const removed = diff.filter((p) => p.removed).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} wide title={`v${a} → v${b}`} description={<span><span className="text-canon">+{added} words</span> · <span className="text-changed">−{removed} words</span></span>}>
      <div className="manuscript max-h-[65vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-sunken p-5 text-base">
        {diff.map((p, i) => p.added
          ? <ins key={i} className="rounded bg-canon-soft text-canon decoration-canon/50">{p.value}</ins>
          : p.removed
            ? <del key={i} className="rounded bg-changed-soft text-changed">{p.value}</del>
            : <span key={i}>{p.value}</span>)}
      </div>
    </Dialog>
  );
}
