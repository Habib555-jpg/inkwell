'use client';
import { useState, useTransition } from 'react';
import { ArrowRight, EyeOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/field';
import { Card, CardHeader } from '@/components/ui/card';
import { OriginBadge, type EditorItem } from './entity-editor';
import type { ActionResult } from '@/app/_actions/result';

type Rel = EditorItem & { fromCharacterId: string; toCharacterId: string; type: string; description: string; isSecret: boolean; active: boolean };
type RelInput = { fromCharacterId: string; toCharacterId: string; type: string; description?: string; isSecret?: boolean };

export function RelationshipsEditor({ characters, relationships, onSave, onDelete }: {
  characters: { id: string; name: string }[]; relationships: Rel[];
  onSave: (id: string | null, v: RelInput) => Promise<ActionResult<{ id: string }>>;
  onDelete: (id: string) => Promise<ActionResult<unknown>>;
}) {
  const [draft, setDraft] = useState<RelInput>({ fromCharacterId: characters[0]?.id ?? '', toCharacterId: characters[1]?.id ?? '', type: '', isSecret: false });
  const [pending, start] = useTransition();
  const name = (id: string) => characters.find((c) => c.id === id)?.name ?? '?';
  const add = () => start(async () => {
    const r = await onSave(null, draft);
    if (r.ok) { toast.success('Relationship added'); setDraft({ ...draft, type: '' }); } else toast.error(r.error);
  });
  const toggleSecret = (r: Rel) => start(async () => { const x = await onSave(r.id, { fromCharacterId: r.fromCharacterId, toCharacterId: r.toCharacterId, type: r.type, isSecret: !r.isSecret }); if (!x.ok) toast.error(x.error); });
  const del = (id: string) => start(async () => { const x = await onDelete(id); if (!x.ok) toast.error(x.error); });
  return (
    <Card>
      <CardHeader title="Relationships" description="Directed: “A trusts B” is not the same as “B trusts A”. Past relationships stay in history when the story changes them." />
      <ul className="divide-y divide-line">
        {relationships.map((r) => (
          <li key={r.id} className={`flex flex-wrap items-center gap-2 px-5 py-3 text-sm ${r.active ? '' : 'opacity-55'}`}>
            <span className="font-medium">{name(r.fromCharacterId)}</span>
            <ArrowRight className="size-3.5 text-ink-faint" aria-hidden />
            <Badge tone="accent">{r.type}</Badge>
            <ArrowRight className="size-3.5 text-ink-faint" aria-hidden />
            <span className="font-medium">{name(r.toCharacterId)}</span>
            {r.isSecret && <Badge tone="changed" icon={<EyeOff className="size-3" aria-hidden />}>secret</Badge>}
            {!r.active && <Badge>past</Badge>}
            <OriginBadge item={r} />
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => toggleSecret(r)} disabled={pending}>{r.isSecret ? 'Mark known' : 'Mark secret'}</Button>
              <Button variant="ghost" size="sm" aria-label="Delete relationship" onClick={() => del(r.id)} disabled={pending} icon={<Trash2 className="size-4 text-changed" aria-hidden />} />
            </div>
          </li>
        ))}
        {relationships.length === 0 && <li className="px-5 py-4 text-sm text-ink-faint">No relationships recorded yet.</li>}
      </ul>
      {characters.length >= 2 && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
          <Select aria-label="From character" value={draft.fromCharacterId} onChange={(e) => setDraft({ ...draft, fromCharacterId: e.target.value })} className="w-auto">
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input aria-label="Relationship" placeholder="trusts, fears, owes…" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="w-44" required />
          <Select aria-label="To character" value={draft.toCharacterId} onChange={(e) => setDraft({ ...draft, toCharacterId: e.target.value })} className="w-auto">
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.isSecret} onChange={(e) => setDraft({ ...draft, isSecret: e.target.checked })} /> Secret</label>
          <Button type="submit" size="sm" loading={pending} icon={<Plus className="size-4" aria-hidden />}>Add</Button>
        </form>
      )}
    </Card>
  );
}
