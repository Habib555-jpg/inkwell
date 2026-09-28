import { and, eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import type { ExtractedFacts, KnownEntities } from '../ai/types';
import { makeResolver } from './names';
import { tokenOverlap } from '../text/tokenize';

export type ExtractionReport = { added: Record<'characters' | 'locations' | 'factions' | 'objects' | 'worldRules' | 'events' | 'relationships', number>; updated: number; conflicts: number; facts: number };
const DEAD = /\b(dead|deceased|died|killed|slain)\b/i;

export async function loadKnownEntities(db: DB, novelId: string): Promise<KnownEntities> {
  const [chars, locs, facs, rules, objs] = await Promise.all([
    db.select({ id: s.characters.id, name: s.characters.name, aliases: s.characters.aliases }).from(s.characters).where(eq(s.characters.novelId, novelId)),
    db.select({ id: s.locations.id, name: s.locations.name }).from(s.locations).where(eq(s.locations.novelId, novelId)),
    db.select({ id: s.factions.id, name: s.factions.name }).from(s.factions).where(eq(s.factions.novelId, novelId)),
    db.select({ id: s.worldRules.id, name: s.worldRules.name, description: s.worldRules.description }).from(s.worldRules).where(eq(s.worldRules.novelId, novelId)),
    db.select({ id: s.storyObjects.id, name: s.storyObjects.name }).from(s.storyObjects).where(eq(s.storyObjects.novelId, novelId)),
  ]);
  return { characters: chars, locations: locs, factions: facs, worldRules: rules, objects: objs };
}

export async function applyExtraction(db: DB, c: { novelId: string; versionId: string; chapterNumber: number; latestCanonNumber: number }, facts: ExtractedFacts): Promise<ExtractionReport> {
  const r: ExtractionReport = { added: { characters: 0, locations: 0, factions: 0, objects: 0, worldRules: 0, events: 0, relationships: 0 }, updated: 0, conflicts: 0, facts: 0 };
  const prov = { origin: 'extracted' as const, sourceChapterVersionId: c.versionId };
  const fact = async (kind: string, content: string, entityId?: string) => { await db.insert(s.chapterFacts).values({ novelId: c.novelId, chapterVersionId: c.versionId, chapterNumber: c.chapterNumber, kind, content, entityId: entityId ?? null }); r.facts++; };
  const conflict = async (v: { kind: 'field' | 'relationship'; entityType: string; entityId: string; field: string; existingValue: string; proposedValue: string; evidence?: string }) => {
    await db.insert(s.memoryConflicts).values({ novelId: c.novelId, chapterVersionId: c.versionId, chapterNumber: c.chapterNumber, ...v, evidence: v.evidence ?? '' }); r.conflicts++;
  };
  const isLatest = c.chapterNumber >= c.latestCanonNumber;

  // world entities
  const worldKinds = [['locations', s.locations, 'location', 'new_location'], ['factions', s.factions, 'faction', 'new_faction'], ['objects', s.storyObjects, 'story_object', 'new_object']] as const;
  const locRows = await db.select().from(s.locations).where(eq(s.locations.novelId, c.novelId));
  const locResolve = () => makeResolver(locRows);
  for (const [key, table, entityType, factKind] of worldKinds) {
    const rows = key === 'locations' ? locRows : await db.select().from(table as typeof s.locations).where(eq((table as typeof s.locations).novelId, c.novelId));
    const find = makeResolver(rows);
    for (const e of facts[key]) {
      const hit = find(e.name);
      if (!hit) {
        const [row] = await db.insert(table as typeof s.locations).values({ novelId: c.novelId, name: e.name, description: e.description ?? '', ...prov }).returning();
        rows.push(row); r.added[key]++; await fact(factKind, e.name, row.id);
      } else if (e.description && !hit.description) {
        await db.update(table as typeof s.locations).set({ description: e.description }).where(eq((table as typeof s.locations).id, hit.id)); r.updated++;
      } else if (e.description && hit.description && tokenOverlap(e.description, hit.description) < 0.3 && key !== 'locations') {
        await conflict({ kind: 'field', entityType, entityId: hit.id, field: 'description', existingValue: hit.description, proposedValue: e.description });
      }
    }
  }
  const locationId = async (name?: string) => {
    if (!name) return null;
    const hit = locResolve()(name); if (hit) return hit.id;
    const [row] = await db.insert(s.locations).values({ novelId: c.novelId, name, ...prov }).returning();
    locRows.push(row); r.added.locations++; await fact('new_location', name, row.id); return row.id;
  };

  // world rules
  const rules = await db.select().from(s.worldRules).where(eq(s.worldRules.novelId, c.novelId));
  const findRule = makeResolver(rules);
  for (const w of facts.worldRules) {
    const byText = rules.find((x) => tokenOverlap(w.description, x.description) >= 0.6);
    if (byText) continue;
    const byName = findRule(w.name);
    if (byName) { await conflict({ kind: 'field', entityType: 'world_rule', entityId: byName.id, field: 'description', existingValue: byName.description, proposedValue: w.description }); continue; }
    const [row] = await db.insert(s.worldRules).values({ novelId: c.novelId, name: w.name, category: w.category, description: w.description, ...prov }).returning();
    rules.push(row); r.added.worldRules++; await fact('world_rule', `${w.name}: ${w.description}`, row.id);
  }

  // characters
  const chars = await db.select().from(s.characters).where(eq(s.characters.novelId, c.novelId));
  let findChar = makeResolver(chars, { firstNames: true });
  for (const e of facts.characters) {
    let hit = findChar(e.name);
    if (!hit) {
      const [row] = await db.insert(s.characters).values({ novelId: c.novelId, name: e.name, developmentNotes: e.description ?? '', currentStatus: e.status ?? '', currentLocationId: await locationId(e.locationName), ...prov }).returning();
      chars.push(row); findChar = makeResolver(chars, { firstNames: true }); r.added.characters++; await fact('new_character', e.name, row.id);
      continue;
    }
    const userOwned = hit.origin === 'user' || hit.userEdited;
    const stateChange = async (field: 'currentStatus' | 'currentLocationId', to: string | null, display: { from: string; to: string }) => {
      const from = hit![field];
      if (!to || from === to) return;
      if (!from) { await db.update(s.characters).set({ [field]: to }).where(eq(s.characters.id, hit!.id)); hit = { ...hit!, [field]: to }; r.updated++; await fact('character_state', JSON.stringify({ field, from: null, to, name: hit!.name }), hit!.id); return; }
      const deadRevival = field === 'currentStatus' && DEAD.test(from) && !DEAD.test(to);
      if (deadRevival || userOwned || !isLatest) {
        await conflict({ kind: 'field', entityType: 'character', entityId: hit!.id, field, existingValue: display.from, proposedValue: display.to, evidence: e.evidence });
        return;
      }
      await db.update(s.characters).set({ [field]: to }).where(eq(s.characters.id, hit!.id)); hit = { ...hit!, [field]: to }; r.updated++;
      await fact('character_state', JSON.stringify({ field, from, to, name: hit!.name }), hit!.id);
    };
    if (e.status) await stateChange('currentStatus', e.status, { from: hit.currentStatus, to: e.status });
    if (e.locationName) {
      const fromName = locRows.find((l) => l.id === hit!.currentLocationId)?.name ?? '';
      await stateChange('currentLocationId', await locationId(e.locationName), { from: fromName, to: e.locationName });
    }
    if (e.description) await fact('character_development', `${hit.name}: ${e.description}`, hit.id);
  }

  // events
  let order = 0;
  for (const ev of facts.events) {
    const ids = ev.characterNames.map((n) => findChar(n)?.id).filter(Boolean) as string[];
    const [row] = await db.insert(s.timelineEvents).values({ novelId: c.novelId, chapterNumber: c.chapterNumber, orderInChapter: order++, description: ev.description, characterIds: [...new Set(ids)], locationId: ev.locationName ? locResolve()(ev.locationName)?.id ?? null : null, importance: ev.importance, ...prov }).returning();
    r.added.events++; await fact('event', ev.description, row.id);
  }

  // relationships
  for (const rel of facts.relationships) {
    const from = findChar(rel.from), to = findChar(rel.to);
    if (!from || !to || from.id === to.id) continue;
    const [existing] = await db.select().from(s.characterRelationships).where(and(eq(s.characterRelationships.fromCharacterId, from.id), eq(s.characterRelationships.toCharacterId, to.id), eq(s.characterRelationships.active, true)));
    if (existing && existing.type.toLowerCase() === rel.type.toLowerCase()) continue;
    if (existing) {
      await conflict({ kind: 'relationship', entityType: 'relationship', entityId: existing.id, field: 'type', existingValue: existing.type,
        proposedValue: JSON.stringify({ type: rel.type, description: rel.description ?? '', isSecret: !!rel.isSecret, fromCharacterId: from.id, toCharacterId: to.id }), evidence: rel.evidence });
      continue;
    }
    const [row] = await db.insert(s.characterRelationships).values({ novelId: c.novelId, fromCharacterId: from.id, toCharacterId: to.id, type: rel.type, description: rel.description ?? '', isSecret: !!rel.isSecret, sinceChapterNumber: c.chapterNumber, ...prov }).returning();
    r.added.relationships++; await fact('relationship', `${from.name} → ${rel.type} → ${to.name}`, row.id);
  }
  for (const rev of facts.revelations) await fact('revelation', rev);
  return r;
}
