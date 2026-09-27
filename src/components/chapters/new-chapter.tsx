'use client';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { RequirementsForm, emptyRequirements } from './requirements-form';
import { createChapterAction } from '@/app/(app)/novels/[novelId]/bible-actions';

export function NewChapter({ novelId, characters, nextNumber }: { novelId: string; characters: { id: string; name: string }[]; nextNumber: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>New chapter</Button>
      <Dialog open={open} onOpenChange={setOpen} wide title={`Plan chapter ${nextNumber}`} description="Tell your writing partner what this chapter must do. Memory from approved chapters is added automatically.">
        <RequirementsForm showNumber initial={emptyRequirements} characters={characters} submitLabel="Create chapter" pending={pending}
          onSubmit={(r) => start(async () => { const res = await createChapterAction(novelId, r); if (res && !res.ok) toast.error(res.error); })} />
      </Dialog>
    </>
  );
}
