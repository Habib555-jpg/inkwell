import { and, asc, eq } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from '../services/access';
import { ConflictError, ValidationError } from '../errors';
import { makeResolver } from './names';

export async function listConflicts(db: DB, userId: string, novelId: string, status: 'open' | 'all' = 'open') {
  await assertNovelOwner(db, userId, novelId);
  const where = status === 'open' ? and(eq(s.memoryConflicts.novelId, novelId), eq(s.memoryConflicts.status, 'open')) : eq(s.memoryConflicts.novelId, novelId);
  return db.select().from(s.memoryConflicts).where(where).orderBy(asc(s.memoryConflicts.createdAt));
}

const TABLES = { character: s.characters, location: s.locations, faction: s.factions, world_rule: s.worldRules, story_object: s.storyObjects, relationship: s.characterRelationships, timeline_event: s.timelineEvents } as const;
const WRITABLE: Record<string, string[]> = { character: ['currentStatus', 'currentLocationId', 'personality', 'appearance', 'developmentNotes'], location: ['description'], faction: ['description'], world_rule: ['description'], story_object: ['description'] };

export async function resolveConflict(db: DB, userId: string, conflictId: string, decision: 'keep_existing' | 'accept_new' | 'merge', mergedValue?: string) {
  const novelId = await assertRowInNovel(db, userId, s.memoryConflicts, conflictId, 'Conflict');
  const [c] = await db.select().from(s.memoryConflicts).where(eq(s.memoryConflicts.id, conflictId));
  if (c.status !== 'open') throw new ConflictError('This conflict was already resolved.');
  if (decision === 'merge' && !mergedValue?.trim()) throw new ValidationError('Enter the corrected value to merge.');
  if (decision === 'merge' && c.kind === 'retracted_record') throw new ValidationError('Choose keep or remove for this record.');
  await db.transaction(async (tx) => {
    if (decision !== 'keep_existing' && c.entityId) {
      const table = TABLES[c.entityType as keyof typeof TABLES] as typeof s.locations;
      if (c.kind === 'retracted_record') {
        if (decision === 'accept_new') await tx.delete(table).where(eq(table.id, c.entityId));
      } else if (c.kind === 'relationship') {
        const [old] = await tx.select().from(s.characterRelationships).where(eq(s.characterRelationships.id, c.entityId));
        if (old && decision === 'accept_new') {
          const p = JSON.parse(c.proposedValue) as { type: string; description: string; isSecret: boolean; fromCharacterId: string; toCharacterId: string };
          await tx.update(s.characterRelationships).set({ active: false }).where(eq(s.characterRelationships.id, old.id));
          await tx.insert(s.characterRelationships).values({ novelId, fromCharacterId: p.fromCharacterId, toCharacterId: p.toCharacterId, type: p.type, description: p.description, isSecret: p.isSecret, sinceChapterNumber: c.chapterNumber, origin: 'extracted', sourceChapterVersionId: c.chapterVersionId });
        } else if (old) await tx.update(s.characterRelationships).set({ type: mergedValue! }).where(eq(s.characterRelationships.id, old.id));
      } else {
        if (!WRITABLE[c.entityType]?.includes(c.field)) throw new ValidationError(`Field ${c.field} cannot be resolved automatically; edit it on the Memory page.`);
        let value: string | null = decision === 'merge' ? mergedValue!.trim() : c.proposedValue;
        if (c.field === 'currentLocationId') {
          const locs = await tx.select().from(s.locations).where(eq(s.locations.novelId, novelId));
          value = makeResolver(locs)(value)?.id ?? (await tx.insert(s.locations).values({ novelId, name: value, origin: 'user' }).returning())[0].id;
        }
        await tx.update(table).set({ [c.field]: value } as never).where(eq(table.id, c.entityId));
      }
    }
    const status = decision === 'keep_existing' ? 'kept_existing' : decision === 'accept_new' ? 'accepted_new' : 'merged';
    await tx.update(s.memoryConflicts).set({ status, resolvedAt: new Date() }).where(eq(s.memoryConflicts.id, conflictId));
  });
}
