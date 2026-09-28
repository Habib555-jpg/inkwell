import { and, eq, ne, sql } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { removeVersionIndex } from '../memory/index-canon';
import { removeDialogueForVersion } from '../voice/profile';
import { purgeCharacterRecord } from '../services/characters';
import { buildNameRegex } from '../text/tokenize';

/** Named story entities: other chapters and the user build on these, so retraction never hard-deletes them blindly. */
export const ENTITY_TABLES = [
  ['character', s.characters], ['location', s.locations], ['faction', s.factions], ['world_rule', s.worldRules], ['story_object', s.storyObjects],
] as const;
/** Records that belong to one chapter version's content. */
const VERSION_SCOPED = [['relationship', s.characterRelationships], ['timeline_event', s.timelineEvents]] as const;
export type EntityType = (typeof ENTITY_TABLES)[number][0];
const asTable = (t: unknown) => t as typeof s.locations;
const label = (row: Record<string, unknown>) => String(row.name ?? row.description ?? row.type ?? '');

async function retractedConflict(db: DB, o: { novelId: string; chapterNumber: number }, entityType: string, row: Record<string, unknown>, why: string) {
  await db.insert(s.memoryConflicts).values({
    novelId: o.novelId, chapterVersionId: null, chapterNumber: o.chapterNumber, kind: 'retracted_record', entityType, entityId: String(row.id), field: '__record__',
    existingValue: label(row), proposedValue: '(remove)', evidence: why,
  });
}

/**
 * Remove what a version contributed: summary, facts, passages, dialogue, its timeline events and relationships
 * (user-edited ones become conflicts when `conflictForEdited`), and optionally revert its state changes.
 * Named entities are NOT deleted here. With `handOverTo` they are handed to the replacing version and
 * reconciled against its text after extraction (reconcileEntities), so their ids — and everything the user
 * and other chapters built on them — survive a re-approval.
 */
export async function clearDerived(db: DB, versionId: string, o: { revertStates: boolean; conflictForEdited: boolean; chapterNumber: number; novelId: string; handOverTo?: string }) {
  if (o.revertStates) {
    const states = await db.select().from(s.chapterFacts).where(and(eq(s.chapterFacts.chapterVersionId, versionId), eq(s.chapterFacts.kind, 'character_state')));
    for (const f of states.reverse()) {
      const { field, from, to } = JSON.parse(f.content) as { field: 'currentStatus' | 'currentLocationId'; from: string | null; to: string };
      if (!f.entityId) continue;
      const [c] = await db.select().from(s.characters).where(eq(s.characters.id, f.entityId));
      if (c && !c.userEdited && c[field] === to) await db.update(s.characters).set({ [field]: field === 'currentStatus' ? from ?? '' : from }).where(eq(s.characters.id, c.id));
    }
  }
  for (const [entityType, table] of VERSION_SCOPED) {
    const t = asTable(table);
    const rows = await db.select().from(t).where(and(eq(t.sourceChapterVersionId, versionId), eq(t.origin, 'extracted')));
    for (const row of rows) {
      if (row.userEdited && o.conflictForEdited) {
        await retractedConflict(db, o, entityType, row, `Created from an earlier approved version of chapter ${o.chapterNumber}, which you replaced. You edited it since, so it was kept for you to decide.`);
        await db.update(t).set({ sourceChapterVersionId: null }).where(eq(t.id, row.id));
      } else if (!row.userEdited) {
        await db.delete(t).where(eq(t.id, row.id));
      }
    }
  }
  if (o.handOverTo) {
    for (const [, table] of ENTITY_TABLES) {
      const t = asTable(table);
      await db.update(t).set({ sourceChapterVersionId: o.handOverTo }).where(and(eq(t.sourceChapterVersionId, versionId), eq(t.origin, 'extracted')));
    }
  }
  await db.delete(s.memoryConflicts).where(and(eq(s.memoryConflicts.chapterVersionId, versionId), eq(s.memoryConflicts.status, 'open')));
  await db.delete(s.chapterFacts).where(eq(s.chapterFacts.chapterVersionId, versionId));
  await db.delete(s.chapterSummaries).where(eq(s.chapterSummaries.chapterVersionId, versionId));
  await removeVersionIndex(db, versionId);
  await removeDialogueForVersion(db, versionId);
}

/** Extracted entities currently attributed to a version — captured before its extraction runs. */
export async function entitiesFromVersion(db: DB, versionId: string): Promise<{ type: EntityType; id: string }[]> {
  const out: { type: EntityType; id: string }[] = [];
  for (const [type, table] of ENTITY_TABLES) {
    const t = asTable(table);
    for (const r of await db.select({ id: t.id }).from(t).where(and(eq(t.sourceChapterVersionId, versionId), eq(t.origin, 'extracted')))) out.push({ type, id: r.id });
  }
  return out;
}

const count = (res: unknown) => Number((res as { rows: { n: number | string }[] }).rows[0]?.n ?? 0);

/** Is anything outside `versionId` built on this entity (dialogue, relationships, facts, references, user voice work, preferences)? */
async function isReferenced(db: DB, type: EntityType, id: string, versionId: string, novelId: string): Promise<boolean> {
  const facts = await db.select({ id: s.chapterFacts.id }).from(s.chapterFacts)
    .where(and(eq(s.chapterFacts.entityId, id), ne(s.chapterFacts.chapterVersionId, versionId))).limit(1);
  if (facts.length) return true;
  if (type === 'character') {
    return count(await db.execute(sql`select
      (select count(*) from dialogue_lines where character_id = ${id} and chapter_version_id <> ${versionId}) +
      (select count(*) from character_relationships where from_character_id = ${id} or to_character_id = ${id}) +
      (select count(*) from chapters where novel_id = ${novelId} and ${id}::uuid = any(character_ids)) +
      (select count(*) from timeline_events where novel_id = ${novelId} and ${id}::uuid = any(character_ids)) +
      (select count(*) from character_voice_profiles where character_id = ${id}
         and (user_voice_notes <> '' or cardinality(locked_fields) > 0 or jsonb_array_length(pinned_samples) > 0)) +
      (select count(*) from writing_preferences where character_id = ${id}) +
      (select count(*) from voice_note_candidates where character_id = ${id}) as n`)) > 0;
  }
  if (type === 'location') {
    return count(await db.execute(sql`select
      (select count(*) from characters where current_location_id = ${id}) +
      (select count(*) from timeline_events where location_id = ${id}) as n`)) > 0;
  }
  return false;
}

/**
 * After a version's extraction: candidates (handed over from the replaced version, or left by a failed run)
 * that the approved text no longer mentions are deleted only if nobody built on them and the user never
 * edited them; otherwise they are kept, detached, and raised as a conflict for the user to decide.
 */
export async function reconcileEntities(db: DB, o: { novelId: string; versionId: string; chapterNumber: number; text: string; candidates: { type: EntityType; id: string }[] }) {
  for (const { type, id } of o.candidates) {
    const t = asTable(ENTITY_TABLES.find(([k]) => k === type)![1]);
    const [row] = await db.select().from(t).where(eq(t.id, id));
    if (!row || row.sourceChapterVersionId !== o.versionId) continue;
    const aliases = (row as typeof row & { aliases?: string[] }).aliases ?? [];
    const names = [row.name, ...aliases, ...(type === 'character' && row.name.includes(' ') ? [row.name.split(' ')[0]] : [])];
    const re = buildNameRegex(names);
    if (re && new RegExp(re.source, 'u').test(o.text)) continue; // still part of this chapter
    if (!row.userEdited && !(await isReferenced(db, type, id, o.versionId, o.novelId))) {
      if (type === 'character') await purgeCharacterRecord(db, id, o.novelId);
      else await db.delete(t).where(eq(t.id, id));
      continue;
    }
    await retractedConflict(db, o, type, row, `No longer in the approved text of chapter ${o.chapterNumber}, but ${row.userEdited ? 'you edited it' : 'other chapters or your notes refer to it'}, so it was kept for you to decide.`);
    await db.update(t).set({ sourceChapterVersionId: null }).where(eq(t.id, id));
  }
}
