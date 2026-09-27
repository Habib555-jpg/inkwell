'use client';
import { Castle, Flag, Gem, ScrollText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityEditor, type EditorItem } from './entity-editor';
import { worldFields, worldRuleFields } from './fields';
import type { ActionResult } from '@/app/_actions/result';

type Kind = 'location' | 'faction' | 'world_rule' | 'story_object';
type WorldValues = { name: string; description?: string; category?: 'magic' | 'technology' | 'history' | 'rule' | 'term' | 'other' };
const KINDS: { kind: Kind; label: string; noun: string; icon: React.ReactNode }[] = [
  { kind: 'location', label: 'Locations', noun: 'Location', icon: <Castle className="size-4" aria-hidden /> },
  { kind: 'faction', label: 'Factions', noun: 'Faction', icon: <Flag className="size-4" aria-hidden /> },
  { kind: 'world_rule', label: 'Rules & systems', noun: 'Rule', icon: <ScrollText className="size-4" aria-hidden /> },
  { kind: 'story_object', label: 'Objects', noun: 'Object', icon: <Gem className="size-4" aria-hidden /> },
];

export function WorldTabs({ items, onSave, onDelete }: {
  items: Record<Kind, EditorItem[]>;
  onSave: (kind: Kind, id: string | null, v: WorldValues) => Promise<ActionResult<{ id: string }>>;
  onDelete: (kind: Kind, id: string) => Promise<ActionResult<unknown>>;
}) {
  return (
    <Tabs defaultValue="location">
      <TabsList aria-label="World categories">
        {KINDS.map((k) => <TabsTrigger key={k.kind} value={k.kind}>{k.icon}{k.label}<span className="text-xs text-ink-faint">{items[k.kind].length}</span></TabsTrigger>)}
      </TabsList>
      {KINDS.map((k) => (
        <TabsContent key={k.kind} value={k.kind}>
          <EntityEditor title={k.label} noun={k.noun} emptyIcon={k.icon} fields={k.kind === 'world_rule' ? worldRuleFields : worldFields} items={items[k.kind]}
            onSave={(id, v) => onSave(k.kind, id, v as WorldValues)} onDelete={(id) => onDelete(k.kind, id)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
