import type { Metadata } from 'next';
import Link from 'next/link';
import { inArray } from 'drizzle-orm';
import { requireUser } from '@/server/auth/session';
import { getAppContext } from '@/server/context';
import { orNotFound } from '@/server/services/novel-page';
import { getNovel } from '@/server/services/novels';
import { getMemoryOverview, listChunks } from '@/server/canon/memory';
import { listConflicts } from '@/server/canon/conflicts';
import { listCharacters } from '@/server/services/characters';
import { listRelationships } from '@/server/services/relationships';
import { listWorldEntities } from '@/server/services/world';
import { listTimeline } from '@/server/services/timeline';
import { chapterNumbersForVersions } from '@/server/services/chapters';
import { getVoiceProfile } from '@/server/voice/profile';
import { listPreferences, listVoiceNoteCandidates } from '@/server/feedback/preferences';
import * as s from '@/server/db/schema';
import { cn } from '@/lib/cn';
import { MemoryOverview } from '@/components/memory/canon-chapters';
import { ConflictsList, type ConflictRow } from '@/components/memory/conflicts-list';
import { VoiceProfileEditor } from '@/components/memory/voice-profile-editor';
import { PreferencesBoard } from '@/components/memory/preferences-board';
import { ChunksList, FactsList } from '@/components/memory/chunks-and-facts';
import { RelationshipsEditor } from '@/components/bible/relationships-editor';
import { WorldTabs } from '@/components/bible/world-tabs';
import { TimelineEditor } from '@/components/bible/timeline-editor';
import { saveRelationshipAction, deleteRelationshipAction, saveWorldEntityAction, deleteWorldEntityAction, saveTimelineEventAction, deleteTimelineEventAction } from '../bible-actions';

export const metadata: Metadata = { title: 'Memory' };
const TABS = [
  ['overview', 'Overview'], ['conflicts', 'Conflicts'], ['characters', 'Characters & voice'], ['relationships', 'Relationships'],
  ['world', 'World'], ['timeline', 'Timeline'], ['preferences', 'Preferences'], ['semantic', 'Semantic memory'], ['facts', 'Facts'],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function MemoryPage({ params, searchParams }: { params: Promise<{ novelId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { novelId } = await params;
  const requested = (await searchParams).tab;
  const tab = (TABS.some(([k]) => k === requested) ? requested : 'overview') as Tab;
  const user = await requireUser(); const ctx = await getAppContext(); const db = ctx.db;
  await orNotFound(() => getNovel(db, user.id, novelId));
  const overview = await getMemoryOverview(db, user.id, novelId);
  const characters = await listCharacters(db, user.id, novelId);
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  const chars = characters.map((c) => ({ id: c.id, name: c.name }));

  let body: React.ReactNode = null;
  if (tab === 'overview') body = <MemoryOverview overview={overview} novelId={novelId} />;
  if (tab === 'conflicts') {
    const conflicts = await listConflicts(db, user.id, novelId);
    const byType = { location: s.locations, faction: s.factions, world_rule: s.worldRules, story_object: s.storyObjects } as unknown as Record<string, typeof s.locations>;
    const nameFor = async (c: (typeof conflicts)[number]) => {
      if (!c.entityId) return '';
      if (c.entityType === 'character') return names[c.entityId] ?? 'Character';
      if (c.entityType === 'relationship') {
        const [r] = await db.select().from(s.characterRelationships).where(inArray(s.characterRelationships.id, [c.entityId]));
        return r ? `${names[r.fromCharacterId] ?? '?'} → ${names[r.toCharacterId] ?? '?'}` : 'Relationship';
      }
      const t = byType[c.entityType];
      if (!t) return c.entityType;
      const [row] = await db.select({ name: t.name }).from(t).where(inArray(t.id, [c.entityId]));
      return row?.name ?? c.entityType;
    };
    const rows: ConflictRow[] = await Promise.all(conflicts.map(async (c) => ({
      id: c.id, kind: c.kind, entityType: c.entityType, entityName: await nameFor(c), field: c.field, existingValue: c.existingValue,
      proposedValue: c.proposedValue, evidence: c.evidence, chapterNumber: c.chapterNumber,
    })));
    body = <ConflictsList conflicts={rows} novelId={novelId} />;
  }
  if (tab === 'characters') {
    const [profiles, notes] = await Promise.all([Promise.all(characters.map((c) => getVoiceProfile(db, user.id, c.id))), listVoiceNoteCandidates(db, user.id, novelId)]);
    body = characters.length ? (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Voice profiles learn only from approved dialogue. Anything you edit is locked and never re-derived. <Link className="text-accent hover:underline" href={`/novels/${novelId}/characters`}>Edit character details →</Link></p>
        {characters.map((c, i) => (
          <div key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
            <VoiceProfileEditor novelId={novelId} name={c.name} profile={profiles[i]} names={names} notes={notes.filter((n) => n.characterId === c.id).map((n) => ({ id: n.id, note: n.note }))} />
          </div>
        ))}
      </div>
    ) : <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">No characters yet.</p>;
  }
  if (tab === 'relationships' || tab === 'world' || tab === 'timeline') {
    const rels = tab === 'relationships' ? await listRelationships(db, user.id, novelId, { includeInactive: true }) : [];
    const world = tab === 'world' ? await Promise.all((['location', 'faction', 'world_rule', 'story_object'] as const).map((k) => listWorldEntities(db, user.id, novelId, k))) : [[], [], [], []];
    const events = tab === 'timeline' ? await listTimeline(db, user.id, novelId) : [];
    const src = await chapterNumbersForVersions(db, novelId, [...rels, ...world.flat(), ...events].map((x) => x.sourceChapterVersionId));
    const withSrc = <T extends { sourceChapterVersionId: string | null }>(x: T) => ({ ...x, sourceChapterNumber: x.sourceChapterVersionId ? src.get(x.sourceChapterVersionId) ?? null : null });
    if (tab === 'relationships') body = <RelationshipsEditor characters={chars} relationships={rels.map(withSrc)} onSave={saveRelationshipAction.bind(null, novelId)} onDelete={deleteRelationshipAction.bind(null, novelId)} />;
    if (tab === 'world') body = <WorldTabs items={{ location: world[0].map(withSrc), faction: world[1].map(withSrc), world_rule: world[2].map(withSrc), story_object: world[3].map(withSrc) }} onSave={saveWorldEntityAction.bind(null, novelId)} onDelete={deleteWorldEntityAction.bind(null, novelId)} />;
    if (tab === 'timeline') body = <TimelineEditor events={events.map(withSrc)} characters={chars} onSave={saveTimelineEventAction.bind(null, novelId)} onDelete={deleteTimelineEventAction.bind(null, novelId)} />;
  }
  if (tab === 'preferences') {
    const p = await listPreferences(db, user.id, novelId);
    body = <PreferencesBoard novelId={novelId} characters={chars} chapterNotes={p.chapterNotes} prefs={{ global: p.global, story: p.story, character: p.character }} />;
  }
  if (tab === 'semantic') body = <ChunksList novelId={novelId} chunks={await listChunks(db, user.id, novelId, { limit: 200 })} model={ctx.embedder.model} />;
  if (tab === 'facts') body = <FactsList novelId={novelId} facts={overview.facts} />;

  return (
    <main className="space-y-6 px-4 py-8 lg:px-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Memory</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">Everything your writing partner remembers comes from approved canon or from you. Inspect it, correct it, or delete it — you are the final authority.</p>
      </header>
      <nav aria-label="Memory sections" className="flex gap-1 overflow-x-auto rounded-xl bg-sunken p-1">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? 'page' : undefined}
            className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium', tab === k ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}>
            {label}{k === 'conflicts' && overview.counts.conflictsOpen > 0 && <span className="rounded-full bg-changed px-1.5 text-xs text-white">{overview.counts.conflictsOpen}</span>}
          </Link>
        ))}
      </nav>
      {body}
    </main>
  );
}
