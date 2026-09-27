'use client';
import { useState, useTransition } from 'react';
import { Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { updateNovelAction } from '@/app/(app)/novels/actions';

type Profile = { title: string; genre: string; premise: string; setting: string; writingStyle: string; tone: string; targetChapterWords: number; rulesText: string; notes: string };

export function NovelProfileForm({ novelId, initial }: { novelId: string; initial: Profile }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = <K extends keyof Profile>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: k === 'targetChapterWords' ? Number(e.target.value) : e.target.value });
  const save = () => start(async () => {
    const r = await updateNovelAction(novelId, v);
    if (!r.ok) { toast.error(r.error); return; }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 md:grid-cols-2">
      <Field label="Title" className="md:col-span-2">{(p) => <Input {...p} value={v.title} onChange={set('title')} required maxLength={200} />}</Field>
      <Field label="Genre">{(p) => <Input {...p} value={v.genre} onChange={set('genre')} />}</Field>
      <Field label="Tone">{(p) => <Input {...p} value={v.tone} onChange={set('tone')} />}</Field>
      <Field label="Premise" className="md:col-span-2">{(p) => <Textarea {...p} value={v.premise} onChange={set('premise')} />}</Field>
      <Field label="World & setting">{(p) => <Textarea {...p} value={v.setting} onChange={set('setting')} className="min-h-32" />}</Field>
      <Field label="Writing style">{(p) => <Textarea {...p} value={v.writingStyle} onChange={set('writingStyle')} className="min-h-32" />}</Field>
      <Field label="Rules & restrictions" hint="Hard rules the story must never break.">{(p) => <Textarea {...p} value={v.rulesText} onChange={set('rulesText')} />}</Field>
      <Field label="Other notes">{(p) => <Textarea {...p} value={v.notes} onChange={set('notes')} />}</Field>
      <Field label="Target chapter length (words)">{(p) => <Input {...p} type="number" min={300} max={20000} value={v.targetChapterWords} onChange={set('targetChapterWords')} />}</Field>
      <div className="flex items-end justify-end gap-3 md:col-span-2">
        <AnimatePresence>
          {saved && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-sm font-medium text-canon">
              <Check className="size-4" aria-hidden /> Saved
            </motion.span>
          )}
        </AnimatePresence>
        <Button type="submit" loading={pending} disabled={!dirty} icon={<Save className="size-4" aria-hidden />}>Save profile</Button>
      </div>
    </form>
  );
}
