'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookCheck, Brain, History, MessageSquareQuote, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { approveAction } from '@/app/(app)/novels/[novelId]/chapters/[chapterId]/actions';

const LEARNS = [
  { icon: BookCheck, text: 'Summary and key events' },
  { icon: History, text: 'Timeline and character state changes' },
  { icon: Users, text: 'New characters, places, factions and relationships' },
  { icon: MessageSquareQuote, text: 'Dialogue voice for each speaking character' },
];

export function ApproveDialog({ open, onOpenChange, versionId, versionNumber, chapterNumber, novelId, onApproved }: {
  open: boolean; onOpenChange: (o: boolean) => void; versionId: string; versionNumber: number; chapterNumber: number; novelId: string; onApproved: () => void;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const approve = () => start(async () => {
    const r = await approveAction(versionId);
    if (!r.ok) { toast.error(r.error); return; }
    onOpenChange(false); onApproved();
    const rep = r.data;
    if (rep.extractionStatus === 'failed') { toast.warning('Chapter is canon, but memory extraction failed. Retry from the banner.'); return; }
    const added = rep.extraction ? Object.values(rep.extraction.added).reduce((a, b) => a + b, 0) : 0;
    const conflicts = rep.extraction?.conflicts ?? 0;
    toast.success(`Canon updated · ${added} new memory item${added === 1 ? '' : 's'}${conflicts ? ` · ${conflicts} conflict${conflicts === 1 ? '' : 's'} to review` : ''}`, {
      action: conflicts ? { label: 'Review', onClick: () => router.push(`/novels/${novelId}/memory?tab=conflicts`) } : undefined,
    });
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Approve v${versionNumber} as canon for chapter ${chapterNumber}?`}
      description="Approved canon is truth: future chapters will be checked and written against it."
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Not yet</Button>
        <Button variant="canon" loading={pending} onClick={approve}>Approve as canon</Button>
      </>}>
      <div className="space-y-4 text-sm">
        <p className="text-ink-soft">Memory will learn from this version:</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {LEARNS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2"><Icon className="size-4 text-canon" aria-hidden />{text}</li>
          ))}
        </ul>
        <p className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-accent">
          <Brain className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Existing memory is never overwritten silently. If this chapter disagrees with what is remembered, you will get a conflict to decide on the <Link className="underline" href={`/novels/${novelId}/memory?tab=conflicts`}>Memory page</Link>.</span>
        </p>
      </div>
    </Dialog>
  );
}
