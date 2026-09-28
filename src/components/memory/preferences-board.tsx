'use client';
import { useState, useTransition } from 'react';
import { Globe, BookOpenText, Pin, PinOff, Plus, Trash2, UserRound, History } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { createPreferenceAction, deletePreferenceAction, setPreferenceStatusAction, updatePreferenceAction } from '@/app/(app)/novels/[novelId]/memory/actions';

export type Pref = { id: string; scope: 'global' | 'story' | 'character'; statement: string; status: 'candidate' | 'active' | 'dismissed'; evidenceCount: number; chaptersSeen: number; pinned: boolean; origin: 'user' | 'extracted'; characterName?: string };
const TONE = { candidate: 'draft', active: 'canon', dismissed: 'neutral' } as const;

function PrefCard({ p, novelId }: { p: Pref; novelId: string }) {
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? 'Failed'); });
  return (
    <li className={cn('rounded-xl border p-3 text-sm', p.status === 'active' ? 'border-canon/30 bg-canon-soft/30' : p.status === 'dismissed' ? 'border-line bg-sunken opacity-70' : 'border-line bg-surface')}>
      <p>{p.statement}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={TONE[p.status]}>{p.status}</Badge>
        {p.origin === 'extracted' ? <span className="text-xs text-ink-faint">{p.evidenceCount} notes across {p.chaptersSeen} chapter{p.chaptersSeen === 1 ? '' : 's'}</span> : <span className="text-xs text-ink-faint">Written by you</span>}
        {p.pinned && <Badge tone="accent" icon={<Pin className="size-3" aria-hidden />}>pinned</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {p.status !== 'active' && <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => setPreferenceStatusAction(novelId, p.id, 'active'))}>Activate</Button>}
        {p.status !== 'dismissed' && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setPreferenceStatusAction(novelId, p.id, 'dismissed'))}>Dismiss</Button>}
        <Button size="sm" variant="ghost" disabled={pending} aria-label={p.pinned ? 'Unpin' : 'Pin'} onClick={() => act(() => updatePreferenceAction(novelId, p.id, { pinned: !p.pinned }))} icon={p.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />} />
        <Button size="sm" variant="ghost" className="text-changed" disabled={pending} aria-label="Delete preference" onClick={() => act(() => deletePreferenceAction(novelId, p.id))} icon={<Trash2 className="size-3.5" />} />
      </div>
    </li>
  );
}

export function PreferencesBoard({ novelId, prefs, chapterNotes, characters }: {
  novelId: string; prefs: { global: Pref[]; story: Pref[]; character: Pref[] }; chapterNotes: { chapterNumber: number; statement: string }[]; characters: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState<{ scope: Pref['scope']; statement: string; characterId: string }>({ scope: 'global', statement: '', characterId: characters[0]?.id ?? '' });
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const r = await createPreferenceAction(novelId, { scope: draft.scope, statement: draft.statement, characterId: draft.scope === 'character' ? draft.characterId : undefined });
    if (r.ok) { toast.success('Preference added'); setDraft({ ...draft, statement: '' }); } else toast.error(r.error);
  });
  const cols = [
    { title: 'Global style', icon: Globe, items: prefs.global, hint: 'How you want every chapter written.' },
    { title: 'Story direction', icon: BookOpenText, items: prefs.story, hint: 'Novel-level content choices.' },
    { title: 'Per character', icon: UserRound, items: prefs.character, hint: 'Never auto-activated — you confirm.' },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">A feedback theme becomes a candidate after 2 notes and an active preference after 3 notes across 2 or more chapters. Chapter-only feedback is never carried to other chapters.</p>
      <div className="grid gap-4 lg:grid-cols-4">
        {cols.map(({ title, icon: Icon, items, hint }) => (
          <section key={title}>
            <h3 className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-accent" aria-hidden />{title}</h3>
            <p className="mb-2 text-xs text-ink-faint">{hint}</p>
            {items.length ? <ul className="space-y-2">{items.map((p) => <PrefCard key={p.id} p={p} novelId={novelId} />)}</ul> : <p className="rounded-xl bg-sunken p-3 text-xs text-ink-faint">None yet.</p>}
          </section>
        ))}
        <section>
          <h3 className="flex items-center gap-2 font-semibold"><History className="size-4 text-ink-faint" aria-hidden />Chapter-only notes</h3>
          <p className="mb-2 text-xs text-ink-faint">History only. Chapter feedback is never applied to other chapters.</p>
          {chapterNotes.length ? <ul className="max-h-80 space-y-1.5 overflow-y-auto text-xs">{chapterNotes.map((n, i) => <li key={i} className="rounded-lg bg-sunken px-2.5 py-1.5"><span className="text-ink-faint">Ch {n.chapterNumber}:</span> {n.statement}</li>)}</ul> : <p className="rounded-xl bg-sunken p-3 text-xs text-ink-faint">None yet.</p>}
        </section>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-4">
        <label className="text-sm">Scope<Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Pref['scope'] })} className="mt-1 w-40">
          <option value="global">Global style</option><option value="story">Story direction</option><option value="character">Character</option></Select></label>
        {draft.scope === 'character' && <label className="text-sm">Character<Select value={draft.characterId} onChange={(e) => setDraft({ ...draft, characterId: e.target.value })} className="mt-1 w-44">
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>}
        <label className="min-w-64 flex-1 text-sm">Your preference<Input value={draft.statement} onChange={(e) => setDraft({ ...draft, statement: e.target.value })} className="mt-1" placeholder="e.g. Keep chapters ending on a hook" required /></label>
        <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden />}>Add your own</Button>
      </form>
    </div>
  );
}
