'use client';
import { useState, useTransition } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { submitFeedbackAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';
import { ProposalReview } from './proposal-review';
import type { WsFeedback, WsProposal } from './types';

const QUESTIONS = [
  { key: 'whatWorked', label: 'What worked?' },
  { key: 'whatDidnt', label: 'What did not work?' },
  { key: 'changesRequested', label: 'What should be changed?' },
  { key: 'charactersOk', label: 'Did the characters behave correctly?' },
  { key: 'dialogueNatural', label: 'Did the dialogue feel natural?' },
  { key: 'followedInstructions', label: 'Did the chapter follow your instructions?' },
  { key: 'remove', label: 'Should anything be removed?' },
  { key: 'add', label: 'Should anything be added?' },
] as const;
type Key = (typeof QUESTIONS)[number]['key'];
const blank = Object.fromEntries(QUESTIONS.map((q) => [q.key, ''])) as Record<Key, string>;

const tone = (r: number) => (r >= 8 ? 'text-canon' : r >= 5 ? 'text-draft' : 'text-changed');

export function FeedbackPanel({ versionId, versionNumber, history, proposal, onProposal, onApplied, onWantsApproval }: {
  versionId: string; versionNumber: number; history: (WsFeedback & { versionNumber: number })[];
  proposal: WsProposal | null; onProposal: (p: WsProposal) => void; onApplied: (notApplied: { change: string }[]) => void; onWantsApproval: () => void;
}) {
  const [rating, setRating] = useState(7);
  const [answers, setAnswers] = useState(blank);
  const [approve, setApprove] = useState(false);
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    const r = await submitFeedbackAction({ versionId, rating, answers, approve });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.data.summary);
    setAnswers(blank);
    onProposal({ id: r.data.proposal.id, source: 'feedback', baseVersionId: versionId, items: r.data.proposal.items });
    if (approve) onWantsApproval();
  });
  return (
    <div className="space-y-6">
      {proposal && proposal.baseVersionId === versionId && <ProposalReview key={proposal.id} proposal={proposal} onApplied={onApplied} />}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
        <div>
          <h3 className="font-semibold">How well does v{versionNumber} match what you wanted?</h3>
          <div className="mt-4 flex items-center gap-4">
            <Slider.Root min={0} max={10} step={0.5} value={[rating]} onValueChange={([v]) => setRating(v)} className="relative flex h-6 flex-1 touch-none select-none items-center" aria-label="Rating from 0 to 10">
              <Slider.Track className="relative h-2 grow rounded-full bg-sunken"><Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-changed via-draft to-canon" /></Slider.Track>
              <Slider.Thumb className="block size-6 cursor-grab rounded-full border-2 border-accent bg-surface shadow-lift focus-visible:outline-2" />
            </Slider.Root>
            <span className={`w-16 text-right font-serif text-3xl font-semibold tabular-nums ${tone(rating)}`}>{rating.toFixed(1)}</span>
          </div>
        </div>
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <label htmlFor={`fb-${q.key}`} className="mb-1 block text-sm font-medium">{q.label}</label>
            <Textarea id={`fb-${q.key}`} value={answers[q.key]} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} className="min-h-16" />
          </div>
        ))}
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="size-4" />Approve this version after saving feedback</label>
        <Button type="submit" className="w-full" loading={pending}>Save feedback &amp; propose changes</Button>
      </form>
      {history.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Rating history</h4>
          <ul className="space-y-1 text-sm">
            {history.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg bg-sunken px-3 py-1.5">
                <span>v{f.versionNumber}</span>
                <span className="text-xs text-ink-faint">{new Date(f.createdAt).toLocaleDateString()}</span>
                <span className={`font-semibold tabular-nums ${tone(f.rating)}`}>{f.rating}/10</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
