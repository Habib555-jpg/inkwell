'use client';
import { CheckCircle2, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type Busy = null | 'generate' | 'improve' | 'check' | 'approve' | 'apply' | 'feedback';

export function ActionBar({ hasVersion, isCanon, busy, onGenerate, onImprove, onCheck, onApprove }: {
  hasVersion: boolean; isCanon: boolean; busy: Busy;
  onGenerate: () => void; onImprove: () => void; onCheck: () => void; onApprove: () => void;
}) {
  const disabled = busy !== null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Chapter actions">
      <Button onClick={onGenerate} loading={busy === 'generate'} disabled={disabled} icon={<Sparkles className="size-4" aria-hidden />}>
        {busy === 'generate' ? 'Generating…' : hasVersion ? 'Regenerate' : 'Generate draft'}
      </Button>
      <Button variant="secondary" onClick={onImprove} loading={busy === 'improve'} disabled={disabled || !hasVersion} icon={<Wand2 className="size-4" aria-hidden />}>
        {busy === 'improve' ? 'Critiquing…' : 'Improve'}
      </Button>
      <Button variant="secondary" onClick={onCheck} loading={busy === 'check'} disabled={disabled || !hasVersion} icon={<ScanSearch className="size-4" aria-hidden />}>
        {busy === 'check' ? 'Checking…' : 'Continuity check'}
      </Button>
      <Button variant="canon" className="ml-auto" onClick={onApprove} loading={busy === 'approve'} disabled={disabled || !hasVersion || isCanon} icon={<CheckCircle2 className="size-4" aria-hidden />}>
        {isCanon ? 'Approved' : 'Approve chapter'}
      </Button>
    </div>
  );
}
