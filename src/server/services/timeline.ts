import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '../db/schema';
import type { DB } from '../db/types';
import { assertNovelOwner, assertRowInNovel } from './access';
import { parse, longText } from '../validation';

export const timelineInputSchema = z.object({
  chapterNumber: z.number().int().min(0),
  orderInChapter: z.number().int().min(0).optional(),
  description: longText.min(1),
  characterIds: z.array(z.string().uuid()).optional(),
  locationId: z.string().uuid().nullable().optional(),
  importance: z.number().int().min(1).max(3).optional(),
});
export async function createTimelineEvent(db: DB, userId: string, novelId: string, input: z.input<typeof timelineInputSchema>) {
  await assertNovelOwner(db, userId, novelId);
  const [e] = await db.insert(s.timelineEvents).values({ ...parse(timelineInputSchema, input), novelId }).returning();
  return e;
}
export async function listTimeline(db: DB, userId: string, novelId: string) {
  await assertNovelOwner(db, userId, novelId);
  return db.select().from(s.timelineEvents).where(eq(s.timelineEvents.novelId, novelId))
    .orderBy(asc(s.timelineEvents.chapterNumber), asc(s.timelineEvents.orderInChapter), asc(s.timelineEvents.createdAt));
}
export async function updateTimelineEvent(db: DB, userId: string, id: string, patch: Partial<z.input<typeof timelineInputSchema>>) {
  await assertRowInNovel(db, userId, s.timelineEvents, id, 'Timeline event');
  const [e] = await db.update(s.timelineEvents).set({ ...parse(timelineInputSchema.partial(), patch), userEdited: true }).where(eq(s.timelineEvents.id, id)).returning();
  return e;
}
export async function deleteTimelineEvent(db: DB, userId: string, id: string) {
  await assertRowInNovel(db, userId, s.timelineEvents, id, 'Timeline event');
  await db.delete(s.timelineEvents).where(eq(s.timelineEvents.id, id));
}
