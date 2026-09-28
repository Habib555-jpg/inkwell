import { and, eq, inArray } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';

export async function describeIncluded(db: DB, novelId: string, included: { section: string; id: string }[]) {
  const ids = (sec: string) => included.filter((i) => i.section === sec).map((i) => i.id);
  const q = async <T>(sec: string, fn: (ids: string[]) => Promise<T[]>) => (ids(sec).length ? fn(ids(sec)) : []);
  const chars = await q('character', (x) => db.select().from(s.characters).where(and(eq(s.characters.novelId, novelId), inArray(s.characters.id, x))));
  const voices = await q('voice', (x) => db.select().from(s.characters).where(and(eq(s.characters.novelId, novelId), inArray(s.characters.id, x))));
  const chunks = await q('chunk', (x) => db.select().from(s.memoryChunks).where(and(eq(s.memoryChunks.novelId, novelId), inArray(s.memoryChunks.id, x))));
  const events = await q('timeline', (x) => db.select().from(s.timelineEvents).where(and(eq(s.timelineEvents.novelId, novelId), inArray(s.timelineEvents.id, x))));
  const rels = await q('relationship', (x) => db.select().from(s.characterRelationships).where(and(eq(s.characterRelationships.novelId, novelId), inArray(s.characterRelationships.id, x))));
  const prefs = await q('preference', (x) => db.select().from(s.writingPreferences).where(and(eq(s.writingPreferences.novelId, novelId), inArray(s.writingPreferences.id, x))));
  const allChars = rels.length ? await db.select({ id: s.characters.id, name: s.characters.name }).from(s.characters).where(eq(s.characters.novelId, novelId)) : [];
  const nm = (id: string) => allChars.find((c) => c.id === id)?.name ?? '?';
  const worldIds = ids('world');
  const world = worldIds.length ? (await Promise.all([s.locations, s.factions, s.worldRules, s.storyObjects].map((t) =>
    db.select({ id: (t as typeof s.locations).id, name: (t as typeof s.locations).name }).from(t as typeof s.locations).where(inArray((t as typeof s.locations).id, worldIds))))).flat() : [];
  const out: { section: string; label: string; detail?: string }[] = [];
  for (const i of included) {
    switch (i.section) {
      case 'profile': out.push({ section: 'profile', label: 'Novel profile' }); break;
      case 'requirements': out.push({ section: 'requirements', label: 'Chapter requirements' }); break;
      case 'character': { const c = chars.find((x) => x.id === i.id); if (c) out.push({ section: 'character', label: c.name }); break; }
      case 'voice': { const c = voices.find((x) => x.id === i.id); if (c) out.push({ section: 'voice', label: c.name }); break; }
      case 'chunk': { const c = chunks.find((x) => x.id === i.id); if (c) out.push({ section: 'chunk', label: `Chapter ${c.chapterNumber} excerpt`, detail: c.content.slice(0, 220) }); break; }
      case 'timeline': { const e = events.find((x) => x.id === i.id); if (e) out.push({ section: 'timeline', label: `Ch ${e.chapterNumber}`, detail: e.description }); break; }
      case 'relationship': { const r = rels.find((x) => x.id === i.id); if (r) out.push({ section: 'relationship', label: `${nm(r.fromCharacterId)} → ${r.type} → ${nm(r.toCharacterId)}` }); break; }
      case 'recent': out.push({ section: 'recent', label: `Chapter ${i.id} summary${out.some((o) => o.section === 'recent') ? '' : ' + ending'}` }); break;
      case 'preference': { const p = prefs.find((x) => x.id === i.id); if (p) out.push({ section: 'preference', label: p.statement }); break; }
      case 'world': { const w = world.find((x) => x.id === i.id); if (w) out.push({ section: 'world', label: w.name }); break; }
    }
  }
  return out;
}
