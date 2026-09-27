'use client';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { deleteNovelAction } from '@/app/(app)/novels/actions';

export function DeleteNovelButton({ novelId, title }: { novelId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setOpen(true)}>Delete novel</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} danger loading={pending} title={`Delete “${title}”?`} confirmLabel="Delete permanently"
        body="This cannot be undone. All chapters, versions, canon, memory and feedback for this novel will be removed."
        onConfirm={() => start(async () => { const r = await deleteNovelAction(novelId); if (r && !r.ok) toast.error(r.error); })} />
    </>
  );
}
