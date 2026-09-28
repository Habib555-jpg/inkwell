import { and, eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { removeVersionIndex } from '../memory/index-canon';
import { removeDialogueForVersion } from '../voice/profile';

const BIBLE = [
  ['character', s.characters], ['location', s.locations], ['faction', s.factions], ['world_rule', s.worldRules],
  ['story_object', s.storyObjects], ['relationship', s.characterRelationships], ['timeline_event', s.timelineEvents],
] as const;

/** Remove everything derived from a version. Optionally revert state progressions and turn user-edited records into conflicts. */
export async function clearDerived(db: DB, versionId: string, o: { revertStates: boolean; conflictForEdited: boolean; chapterNumber: number; novelId: string }) {
  if (o.revertStates) {
    const states = await db.select().from(s.chapterFacts).where(and(eq(s.chapterFacts.chapterVersionId, versionId), eq(s.chapterFacts.kind, 'character_state')));
    for (const f of states.reverse()) {
      const { field, from, to } = JSON.parse(f.content) as { field: 'currentStatus' | 'currentLocationId'; from: string | null; to: string };
      if (!f.entityId) continue;
      const [c] = await db.select().from(s.characters).where(eq(s.characters.id, f.entityId));
      if (c && !c.userEdited && c[field] === to) await db.update(s.characters).set({ [field]: field === 'currentStatus' ? from ?? '' : from }).where(eq(s.characters.id, c.id));
    }
  }
  for (const [entityType, table] of BIBLE) {
    const t = table as typeof s.locations;
    const rows = await db.select().from(t).where(and(eq(t.sourceChapterVersionId, versionId), eq(t.origin, 'extracted')));
    for (const row of rows) {
      if (row.userEdited && o.conflictForEdited) {
        await db.insert(s.memoryConflicts).values({ novelId: o.novelId, chapterVersionId: null, chapterNumber: o.chapterNumber, kind: 'retracted_record', entityType, entityId: row.id, field: '__record__',
          existingValue: 'name' in row ? String(row.name) : String((row as { description?: string; type?: string }).description ?? (row as { type?: string }).type ?? ''),
          proposedValue: '(remove)', evidence: `Created from an earlier approved version of chapter ${o.chapterNumber}, which you replaced. You edited it since, so it was kept for you to decide.` });
        await db.update(t).set({ sourceChapterVersionId: null }).where(eq(t.id, row.id));
      } else if (!row.userEdited) {
        await db.delete(t).where(eq(t.id, row.id));
      }
    }
  }
  await db.delete(s.memoryConflicts).where(and(eq(s.memoryConflicts.chapterVersionId, versionId), eq(s.memoryConflicts.status, 'open')));
  await db.delete(s.chapterFacts).where(eq(s.chapterFacts.chapterVersionId, versionId));
  await db.delete(s.chapterSummaries).where(eq(s.chapterSummaries.chapterVersionId, versionId));
  await removeVersionIndex(db, versionId);
  await removeDialogueForVersion(db, versionId);
}
