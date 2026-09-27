'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';

export type Requirements = {
  number?: number; title: string; mainIdea: string; requiredEvents: string[]; forbiddenEvents: string[]; characterIds: string[];
  tone: string; dialoguePoints: string[]; restrictions: string; targetWords: number | null; instructions: string;
};
export const emptyRequirements: Requirements = { title: '', mainIdea: '', requiredEvents: [], forbiddenEvents: [], characterIds: [], tone: '', dialoguePoints: [], restrictions: '', targetWords: null, instructions: '' };
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Full chapter-requirements form: used to create chapters and (Task 21) in the workspace drawer. */
export function RequirementsForm({ initial, characters, submitLabel, onSubmit, pending, showNumber }: {
  initial: Requirements; characters: { id: string; name: string }[]; submitLabel: string;
  onSubmit: (r: Requirements) => void; pending?: boolean; showNumber?: boolean;
}) {
  const [v, setV] = useState({ ...initial, required: initial.requiredEvents.join('\n'), forbidden: initial.forbiddenEvents.join('\n'), dialogue: initial.dialoguePoints.join('\n') });
  const submit = () => onSubmit({
    number: v.number, title: v.title, mainIdea: v.mainIdea, requiredEvents: lines(v.required), forbiddenEvents: lines(v.forbidden),
    characterIds: v.characterIds, tone: v.tone, dialoguePoints: lines(v.dialogue), restrictions: v.restrictions, targetWords: v.targetWords, instructions: v.instructions,
  });
  const toggleChar = (id: string) => setV({ ...v, characterIds: v.characterIds.includes(id) ? v.characterIds.filter((x) => x !== id) : [...v.characterIds, id] });
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4 md:grid-cols-2">
      {showNumber && <Field label="Chapter number" hint="Leave blank for the next number.">{(p) => <Input {...p} type="number" min={1} value={v.number ?? ''} onChange={(e) => setV({ ...v, number: e.target.value ? Number(e.target.value) : undefined })} />}</Field>}
      <Field label="Title" className={showNumber ? '' : 'md:col-span-2'}>{(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
      <Field label="Main idea" className="md:col-span-2">{(p) => <Textarea {...p} value={v.mainIdea} onChange={(e) => setV({ ...v, mainIdea: e.target.value })} placeholder="What is this chapter about?" />}</Field>
      <Field label="Events that must happen" hint="One per line, in order.">{(p) => <Textarea {...p} value={v.required} onChange={(e) => setV({ ...v, required: e.target.value })} />}</Field>
      <Field label="Events that must NOT happen" hint="One per line.">{(p) => <Textarea {...p} value={v.forbidden} onChange={(e) => setV({ ...v, forbidden: e.target.value })} />}</Field>
      <Field label="Important dialogue points" hint="One per line. Quote exact lines if you have them.">{(p) => <Textarea {...p} value={v.dialogue} onChange={(e) => setV({ ...v, dialogue: e.target.value })} />}</Field>
      <Field label="Restrictions">{(p) => <Textarea {...p} value={v.restrictions} onChange={(e) => setV({ ...v, restrictions: e.target.value })} />}</Field>
      <Field label="Desired tone">{(p) => <Input {...p} value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value })} />}</Field>
      <Field label="Desired length (words)" hint="Blank uses the novel's target.">{(p) => <Input {...p} type="number" min={200} max={20000} value={v.targetWords ?? ''} onChange={(e) => setV({ ...v, targetWords: e.target.value ? Number(e.target.value) : null })} />}</Field>
      <Field label="Additional instructions" className="md:col-span-2">{(p) => <Textarea {...p} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />}</Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Characters involved</legend>
        {characters.length === 0 ? <p className="text-sm text-ink-faint">Add characters to the story bible to select them here.</p> : (
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => {
              const on = v.characterIds.includes(c.id);
              return (
                <button type="button" key={c.id} aria-pressed={on} onClick={() => toggleChar(c.id)}
                  className={cn('h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors', on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface hover:border-line-strong')}>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
      <div className="flex justify-end md:col-span-2"><Button type="submit" loading={pending}>{submitLabel}</Button></div>
    </form>
  );
}
