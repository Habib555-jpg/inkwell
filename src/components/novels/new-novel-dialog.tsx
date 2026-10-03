'use client';
import { useState, useTransition } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { createNovelAction } from '@/app/(app)/novels/actions';

type Char = { name: string; personality: string };

export function NewNovelDialog({ trigger }: { trigger?: 'button' | 'hero' }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [chars, setChars] = useState<Char[]>([{ name: '', personality: '' }]);

  const submit = (form: FormData) => start(async () => {
    const s = (k: string) => String(form.get(k) ?? '').trim();
    const words = Number(form.get('targetChapterWords') || 0);
    const r = await createNovelAction({
      title: s('title'), genre: s('genre'), premise: s('premise'), setting: s('setting'), writingStyle: s('writingStyle'),
      tone: s('tone'), rulesText: s('rulesText'), notes: s('notes'),
      ...(words ? { targetChapterWords: words } : {}),
      characters: chars.filter((c) => c.name.trim()),
    });
    if (r && !r.ok) toast.error(r.error);
  });

  return (
    <>
      <Button shimmer size={trigger === 'hero' ? 'lg' : 'md'} icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>New novel</Button>
      <Dialog open={open} onOpenChange={setOpen} wide title="Start a new novel" description="Everything here becomes the novel's permanent profile. You can refine it any time.">
        <form action={submit} className="grid gap-4 md:grid-cols-2">
          <Field label="Title" className="md:col-span-2">{(p) => <Input {...p} name="title" required maxLength={200} placeholder="The Ashen Crown" />}</Field>
          <Field label="Genre">{(p) => <Input {...p} name="genre" placeholder="Dark fantasy" />}</Field>
          <Field label="Tone">{(p) => <Input {...p} name="tone" placeholder="Tense, wry" />}</Field>
          <Field label="Premise" className="md:col-span-2">{(p) => <Textarea {...p} name="premise" placeholder="A thief inherits a cursed crown…" />}</Field>
          <Field label="World & setting">{(p) => <Textarea {...p} name="setting" />}</Field>
          <Field label="Writing style">{(p) => <Textarea {...p} name="writingStyle" placeholder="Close third person, short chapters…" />}</Field>
          <Field label="Rules & restrictions" hint="Hard rules the story must never break.">{(p) => <Textarea {...p} name="rulesText" />}</Field>
          <Field label="Other notes">{(p) => <Textarea {...p} name="notes" />}</Field>
          <Field label="Target chapter length (words)">{(p) => <Input {...p} name="targetChapterWords" type="number" min={300} max={20000} placeholder="2500" />}</Field>

          <fieldset className="md:col-span-2">
            <legend className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft"><span aria-hidden className="size-1.5 rotate-45 rounded-[1px] bg-gradient-to-br from-gold to-accent" />Main characters</legend>
            <div className="space-y-2">
              {chars.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold via-accent to-ember font-serif text-sm font-semibold text-white">{c.name.trim().charAt(0).toUpperCase() || i + 1}</span>
                  <Input aria-label={`Character ${i + 1} name`} placeholder="Name" value={c.name} onChange={(e) => setChars(chars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="md:max-w-56" />
                  <Input aria-label={`Character ${i + 1} personality`} placeholder="Personality in a few words" value={c.personality} onChange={(e) => setChars(chars.map((x, j) => (j === i ? { ...x, personality: e.target.value } : x)))} />
                  <button type="button" aria-label="Remove character" onClick={() => setChars(chars.filter((_, j) => j !== i))} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-faint hover:bg-sunken hover:text-changed"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2" icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setChars([...chars, { name: '', personality: '' }])}>Add character</Button>
          </fieldset>

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Create novel</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
