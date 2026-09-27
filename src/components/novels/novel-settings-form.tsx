'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { updateNovelSettingsAction } from '@/app/(app)/novels/actions';

type Settings = { dialogueBalance: 'dialogue_heavy' | 'balanced' | 'narration_heavy'; pov: string; tense: string; aiModel: string | null; retrievalTopK: number; contextTokenBudget: number };
const BALANCE = [
  { value: 'dialogue_heavy', label: 'Dialogue-heavy', hint: '≈45%+ of words in dialogue' },
  { value: 'balanced', label: 'Balanced', hint: '≈25–45% dialogue' },
  { value: 'narration_heavy', label: 'Narration-heavy', hint: 'under ≈25% dialogue' },
] as const;

export function NovelSettingsForm({ novelId, initial }: { novelId: string; initial: Settings }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await updateNovelSettingsAction(novelId, { ...v, aiModel: v.aiModel?.trim() ? v.aiModel.trim() : null });
    if (r.ok) toast.success('Settings saved'); else toast.error(r.error);
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Dialogue balance</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {BALANCE.map((b) => (
            <label key={b.value} className={cn('cursor-pointer rounded-xl border p-3 transition-colors', v.dialogueBalance === b.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}>
              <input type="radio" name="balance" value={b.value} className="sr-only" checked={v.dialogueBalance === b.value} onChange={() => setV({ ...v, dialogueBalance: b.value })} />
              <span className="block text-sm font-medium">{b.label}</span>
              <span className="block text-xs text-ink-faint">{b.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Point of view">{(p) => (
          <Select {...p} value={v.pov} onChange={(e) => setV({ ...v, pov: e.target.value })}>
            <option value="first_person">First person</option><option value="third_limited">Third person limited</option>
            <option value="third_omniscient">Third person omniscient</option><option value="second_person">Second person</option>
          </Select>)}</Field>
        <Field label="Tense">{(p) => (
          <Select {...p} value={v.tense} onChange={(e) => setV({ ...v, tense: e.target.value })}>
            <option value="past">Past</option><option value="present">Present</option>
          </Select>)}</Field>
        <Field label="Relevant canon passages per chapter" hint="How many older passages retrieval may add (1–30).">
          {(p) => <Input {...p} type="number" min={1} max={30} value={v.retrievalTopK} onChange={(e) => setV({ ...v, retrievalTopK: Number(e.target.value) })} />}</Field>
        <Field label="Context budget (tokens)" hint="Upper bound on memory sent with each request. Keeps cost flat as the novel grows.">
          {(p) => <Input {...p} type="number" min={1500} max={60000} step={500} value={v.contextTokenBudget} onChange={(e) => setV({ ...v, contextTokenBudget: Number(e.target.value) })} />}</Field>
        <Field label="Model override (optional)" hint="Leave blank to use AI_MODEL from the server environment." className="sm:col-span-2">
          {(p) => <Input {...p} value={v.aiModel ?? ''} placeholder="e.g. claude-opus-5" onChange={(e) => setV({ ...v, aiModel: e.target.value })} />}</Field>
      </div>
      <div className="flex justify-end"><Button type="submit" loading={pending}>Save settings</Button></div>
    </form>
  );
}
