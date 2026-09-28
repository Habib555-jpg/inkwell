'use client';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Check, Info, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { applyProposalAction, updateProposalAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import type { RevisionItem, FeedbackScope } from '@/server/ai/types';
import type { WsProposal } from './types';

const SCOPES: { value: FeedbackScope; label: string }[] = [
  { value: 'chapter', label: 'This chapter only' }, { value: 'character', label: 'This character' },
  { value: 'story', label: 'Story direction' }, { value: 'global', label: 'Global style' },
];

export function ProposalReview({ proposal, onApplied }: { proposal: WsProposal; onApplied: (notApplied: { change: string }[]) => void }) {
  const [items, setItems] = useState<RevisionItem[]>(proposal.items);
  const [suggested] = useState(() => Object.fromEntries(proposal.items.map((i) => [i.id, i.scope])));
  const [pending, start] = useTransition();
  const update = (id: string, patch: Partial<Pick<RevisionItem, 'status' | 'scope'>>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    start(async () => { const r = await updateProposalAction(proposal.id, [{ id, ...patch }]); if (!r.ok) toast.error(r.error); });
  };
  const accepted = items.filter((i) => i.status === 'accepted').length;
  const apply = () => start(async () => {
    const r = await applyProposalAction(proposal.id);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Revised draft created from ${accepted} change${accepted === 1 ? '' : 's'}`);
    onApplied(r.data.notApplied);
  });
  if (!items.length) return <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">No concrete changes were found. Try naming what to add, remove or change.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{proposal.source === 'critic' ? 'Critic suggestions' : 'Proposed changes'}</h3>
        <span className="text-xs text-ink-faint">{accepted} of {items.length} accepted</span>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <motion.li key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cn('rounded-xl border p-3', it.status === 'accepted' ? 'border-canon/40 bg-canon-soft/40' : it.status === 'rejected' ? 'border-line bg-sunken opacity-60' : 'border-line bg-surface')}>
            <p className="text-sm">{it.change}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="info">{it.action.replaceAll('_', ' ')}</Badge>
              <span className="text-xs text-ink-faint">{it.rationale}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Decision">
                <button onClick={() => update(it.id, { status: 'accepted' })} aria-pressed={it.status === 'accepted'}
                  className={cn('inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-medium', it.status === 'accepted' ? 'bg-canon text-white' : 'hover:bg-sunken')}><Check className="size-3.5" aria-hidden />Accept</button>
                <button onClick={() => update(it.id, { status: 'rejected' })} aria-pressed={it.status === 'rejected'}
                  className={cn('inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-medium', it.status === 'rejected' ? 'bg-changed text-white' : 'hover:bg-sunken')}><X className="size-3.5" aria-hidden />Reject</button>
              </div>
              <label className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
                Applies to
                <select value={it.scope} onChange={(e) => update(it.id, { scope: e.target.value as FeedbackScope })} className="h-8 cursor-pointer rounded-md border border-line bg-surface px-2 text-xs">
                  {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}{suggested[it.id] === s.value ? ' (suggested)' : ''}</option>)}
                </select>
              </label>
            </div>
          </motion.li>
        ))}
      </ul>
      <p className="flex items-start gap-2 text-xs text-ink-faint"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Global style and story notes only become writing preferences after they recur across chapters. Chapter-only notes never carry forward.</p>
      <Button className="w-full" onClick={apply} loading={pending} disabled={!accepted} icon={<Wand2 className="size-4" aria-hidden />}>Apply {accepted || ''} accepted change{accepted === 1 ? '' : 's'}</Button>
    </div>
  );
}
