'use client';
import { useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Plus, Search, Sparkles, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import type { ActionResult } from '@/app/_actions/result';
import type { FieldDef } from './fields';

export type EditorItem = Record<string, unknown> & { id: string; name?: string; origin?: string; userEdited?: boolean; sourceChapterNumber?: number | null };
type Values = Record<string, unknown>;

function toForm(fields: FieldDef[], item: EditorItem | null): Record<string, string> {
  return Object.fromEntries(fields.map((f) => {
    const v = item?.[f.name];
    if (f.kind === 'list') return [f.name, Array.isArray(v) ? v.join('\n') : ''];
    return [f.name, v == null ? '' : String(v)];
  }));
}
function fromForm(fields: FieldDef[], form: Record<string, string>): Values {
  return Object.fromEntries(fields.map((f) => {
    const v = form[f.name] ?? '';
    if (f.kind === 'list') return [f.name, v.split('\n').map((x) => x.trim()).filter(Boolean)];
    if (f.kind === 'number') return [f.name, v === '' ? undefined : Number(v)];
    if (f.kind === 'select') return [f.name, v === '' ? undefined : v];
    return [f.name, v];
  }));
}

export function OriginBadge({ item }: { item: EditorItem }) {
  if (item.origin === 'extracted')
    return <Badge tone="info" icon={<Sparkles className="size-3" aria-hidden />}>{`Extracted${item.sourceChapterNumber ? ` · ch ${item.sourceChapterNumber}` : ''}${item.userEdited ? ' · edited' : ''}`}</Badge>;
  return <Badge tone="neutral" icon={<UserRound className="size-3" aria-hidden />}>Yours</Badge>;
}

export function EntityEditor({ title, noun, fields, items, onSave, onDelete, renderExtra, emptyIcon }: {
  title: string; noun: string; fields: FieldDef[]; items: EditorItem[];
  onSave: (id: string | null, values: Values) => Promise<ActionResult<{ id: string }>>;
  onDelete: (id: string) => Promise<ActionResult<unknown>>;
  renderExtra?: (item: EditorItem) => React.ReactNode; emptyIcon?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [creating, setCreating] = useState(items.length === 0);
  const current = creating ? null : items.find((i) => i.id === selected) ?? null;
  const [form, setForm] = useState(() => toForm(fields, current));
  const [baseline, setBaseline] = useState(form);
  const [query, setQuery] = useState('');
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const [pendingSwitch, setPendingSwitch] = useState<{ item: EditorItem | null } | null>(null);
  const load = (item: EditorItem | null) => {
    const f = toForm(fields, item); setForm(f); setBaseline(f);
    setCreating(item === null); setSelected(item?.id ?? null);
  };
  /** Switching items with unsaved edits asks first (in-UI, never a browser dialog). */
  const open = (item: EditorItem | null) => (dirty ? setPendingSwitch({ item }) : load(item));
  const filtered = useMemo(() => items.filter((i) => String(i.name ?? '').toLowerCase().includes(query.toLowerCase())), [items, query]);

  const save = () => start(async () => {
    const r = await onSave(current?.id ?? null, fromForm(fields, form));
    if (!r.ok) { toast.error(r.error); return; }
    setBaseline(form); setCreating(false); setSelected(r.data.id);
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  });
  const remove = () => start(async () => {
    if (!current) return;
    const r = await onDelete(current.id);
    if (!r.ok) { toast.error(r.error); return; }
    setConfirmDelete(false); toast.success(`${noun} deleted`);
    const rest = items.filter((i) => i.id !== current.id);
    load(rest[0] ?? null);
  });

  if (items.length === 0 && !creating)
    return <EmptyState icon={emptyIcon ?? <Plus className="size-5" />} title={`No ${title.toLowerCase()} yet`} action={<Button onClick={() => open(null)}>Add {noun.toLowerCase()}</Button>} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label={`Search ${title}`} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto" role="listbox" aria-label={title}>
          {filtered.map((i) => (
            <li key={i.id}>
              <button role="option" aria-selected={!creating && selected === i.id} onClick={() => open(i)}
                className={cn('flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  !creating && selected === i.id ? 'bg-accent-soft text-accent' : 'hover:bg-sunken')}>
                <span className="font-medium">{String(i.name ?? 'Untitled')}</span>
                <OriginBadge item={i} />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-2 w-full" icon={<Plus className="size-4" aria-hidden />} onClick={() => open(null)}>Add {noun.toLowerCase()}</Button>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{creating ? `New ${noun.toLowerCase()}` : String(current?.name ?? '')}</h2>
          {current && <OriginBadge item={current} />}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.name} label={f.label} className={cn((f.kind === 'textarea' || f.wide) && 'md:col-span-2', f.kind === 'textarea' && !f.wide && 'md:col-span-1')}>
              {(p) => f.kind === 'textarea' || f.kind === 'list'
                ? <Textarea {...p} value={form[f.name]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                : f.kind === 'select'
                  ? <Select {...p} value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      <option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  : <Input {...p} type={f.kind === 'number' ? 'number' : 'text'} value={form[f.name]} placeholder={f.placeholder} required={f.name === 'name'} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}
            </Field>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2">
            {current ? <Button type="button" variant="ghost" className="text-changed" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>Delete</Button> : <span />}
            <div className="flex items-center gap-3">
              {dirty && <span className="text-xs text-draft">Unsaved changes</span>}
              <AnimatePresence>{saved && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-sm text-canon"><Check className="size-4" aria-hidden />Saved</motion.span>}</AnimatePresence>
              <Button type="submit" loading={pending} disabled={!dirty && !creating}>{creating ? `Create ${noun.toLowerCase()}` : 'Save changes'}</Button>
            </div>
          </div>
        </form>
        {current && renderExtra?.(current)}
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} danger loading={pending} title={`Delete ${String(current?.name ?? noun)}?`} confirmLabel="Delete"
        body="This removes it from the story bible and memory. Approved chapter text is not changed." onConfirm={remove} />
      <ConfirmDialog open={!!pendingSwitch} onOpenChange={(o) => !o && setPendingSwitch(null)} title="Discard unsaved changes?" confirmLabel="Discard"
        body="You have edits that are not saved yet." onConfirm={() => { if (pendingSwitch) load(pendingSwitch.item); setPendingSwitch(null); }} />
    </div>
  );
}
