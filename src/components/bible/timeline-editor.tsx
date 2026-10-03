'use client';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { OriginBadge, type EditorItem } from './entity-editor';
import type { ActionResult } from '@/app/_actions/result';

type Ev = EditorItem & { chapterNumber: number; orderInChapter: number; description: string; importance: number; characterIds: string[] };
type EvInput = { chapterNumber: number; description: string; importance?: number; characterIds?: string[] };

export function TimelineEditor({ events, characters, onSave, onDelete }: {
  events: Ev[]; characters: { id: string; name: string }[];
  onSave: (id: string | null, v: EvInput) => Promise<ActionResult<{ id: string }>>;
  onDelete: (id: string) => Promise<ActionResult<unknown>>;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<EvInput>({ chapterNumber: 1, description: '', importance: 2 });
  const chapters = [...new Set(events.map((e) => e.chapterNumber))].sort((a, b) => a - b);
  const name = (id: string) => characters.find((c) => c.id === id)?.name;

  const add = () => start(async () => { const r = await onSave(null, draft); if (r.ok) setDraft({ ...draft, description: '' }); else toast.error(r.error); });
  const saveEdit = (e: Ev) => start(async () => { const r = await onSave(e.id, { chapterNumber: e.chapterNumber, description: text }); if (r.ok) setEditing(null); else toast.error(r.error); });
  const del = (id: string) => start(async () => { const r = await onDelete(id); if (!r.ok) toast.error(r.error); });

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap items-end gap-2 glass rounded-[var(--radius-card)] border border-line p-4 shadow-card">
        <label className="text-sm">Chapter<Input type="number" min={0} value={draft.chapterNumber} onChange={(e) => setDraft({ ...draft, chapterNumber: Number(e.target.value) })} className="mt-1 w-24" /></label>
        <label className="min-w-64 flex-1 text-sm">Event<Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What happened?" className="mt-1" required /></label>
        <label className="text-sm">Importance<Select value={draft.importance} onChange={(e) => setDraft({ ...draft, importance: Number(e.target.value) })} className="mt-1 w-32">
          <option value={1}>Minor</option><option value={2}>Notable</option><option value={3}>Turning point</option></Select></label>
        <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden />}>Add event</Button>
      </form>
      {events.length === 0 ? <EmptyState icon={<Star className="size-5" />} title="The timeline is empty">Events are added automatically when you approve chapters, or you can add them yourself.</EmptyState> : (
        <ol className="relative space-y-8 border-l-2 border-line pl-6">
          {chapters.map((ch) => (
            <li key={ch}>
              <span className="absolute -left-[9px] mt-1 size-4 rounded-full border-2 border-accent bg-paper" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Chapter {ch}</h2>
              <ul className="mt-3 space-y-2">
                {events.filter((e) => e.chapterNumber === ch).map((e, i) => (
                  <motion.li key={e.id} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.04 }}
                    className="rounded-xl border border-line bg-surface p-3 shadow-card">
                    {editing === e.id ? (
                      <div className="space-y-2">
                        <Textarea value={text} onChange={(x) => setText(x.target.value)} aria-label="Event description" />
                        <div className="flex gap-2"><Button size="sm" loading={pending} onClick={() => saveEdit(e)}>Save</Button><Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start gap-2">
                        {e.importance === 3 && <Star className="mt-0.5 size-4 fill-draft text-draft" aria-label="Turning point" />}
                        <p className="min-w-0 flex-1 text-sm">{e.description}</p>
                        <OriginBadge item={e} />
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(e.id); setText(e.description); }}>Edit</Button>
                        <Button size="sm" variant="ghost" aria-label="Delete event" onClick={() => del(e.id)} icon={<Trash2 className="size-4 text-changed" aria-hidden />} />
                        {e.characterIds.length > 0 && <p className="w-full text-xs text-ink-faint">{e.characterIds.map(name).filter(Boolean).join(', ')}</p>}
                      </div>
                    )}
                  </motion.li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
