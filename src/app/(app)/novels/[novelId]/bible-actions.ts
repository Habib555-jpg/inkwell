'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAppDb } from '@/server/context';
import { requireUserForAction } from '@/server/auth/session';
import { runAction } from '@/app/_actions/result';
import { createCharacter, updateCharacter, deleteCharacter, type CharacterInput } from '@/server/services/characters';
import { createRelationship, updateRelationship, deleteRelationship } from '@/server/services/relationships';
import { createWorldEntity, updateWorldEntity, deleteWorldEntity, type WorldKind } from '@/server/services/world';
import { createTimelineEvent, updateTimelineEvent, deleteTimelineEvent } from '@/server/services/timeline';
import { createChapter, type ChapterRequirementsInput } from '@/server/services/chapters';

async function ctx() { return { user: await requireUserForAction(), db: await getAppDb() }; }
const refresh = (novelId: string, ...paths: string[]) => { for (const p of paths) revalidatePath(`/novels/${novelId}/${p}`); revalidatePath(`/novels/${novelId}`, 'layout'); };

export async function saveCharacterAction(novelId: string, id: string | null, values: Partial<CharacterInput>) {
  return runAction(async () => {
    const { user, db } = await ctx();
    const c = id ? await updateCharacter(db, user.id, id, values) : await createCharacter(db, user.id, novelId, values as CharacterInput);
    refresh(novelId, 'characters', 'memory'); return { id: c.id };
  });
}
export async function deleteCharacterAction(novelId: string, id: string) {
  return runAction(async () => { const { user, db } = await ctx(); await deleteCharacter(db, user.id, id); refresh(novelId, 'characters', 'memory'); return null; });
}

export async function saveRelationshipAction(novelId: string, id: string | null, values: Parameters<typeof createRelationship>[3]) {
  return runAction(async () => {
    const { user, db } = await ctx();
    const r = id ? await updateRelationship(db, user.id, id, values) : await createRelationship(db, user.id, novelId, values);
    refresh(novelId, 'characters', 'memory'); return { id: r.id };
  });
}
export async function deleteRelationshipAction(novelId: string, id: string) {
  return runAction(async () => { const { user, db } = await ctx(); await deleteRelationship(db, user.id, id); refresh(novelId, 'characters', 'memory'); return null; });
}

export async function saveWorldEntityAction(novelId: string, kind: WorldKind, id: string | null, values: Parameters<typeof createWorldEntity>[4]) {
  return runAction(async () => {
    const { user, db } = await ctx();
    const e = id ? await updateWorldEntity(db, user.id, kind, id, values) : await createWorldEntity(db, user.id, novelId, kind, values);
    refresh(novelId, 'world', 'memory'); return { id: e.id };
  });
}
export async function deleteWorldEntityAction(novelId: string, kind: WorldKind, id: string) {
  return runAction(async () => { const { user, db } = await ctx(); await deleteWorldEntity(db, user.id, kind, id); refresh(novelId, 'world', 'memory'); return null; });
}

export async function saveTimelineEventAction(novelId: string, id: string | null, values: Parameters<typeof createTimelineEvent>[3]) {
  return runAction(async () => {
    const { user, db } = await ctx();
    const e = id ? await updateTimelineEvent(db, user.id, id, values) : await createTimelineEvent(db, user.id, novelId, values);
    refresh(novelId, 'timeline', 'memory'); return { id: e.id };
  });
}
export async function deleteTimelineEventAction(novelId: string, id: string) {
  return runAction(async () => { const { user, db } = await ctx(); await deleteTimelineEvent(db, user.id, id); refresh(novelId, 'timeline', 'memory'); return null; });
}

export async function createChapterAction(novelId: string, input: ChapterRequirementsInput & { number?: number }) {
  const r = await runAction(async () => {
    const { user, db } = await ctx();
    const c = await createChapter(db, user.id, novelId, input);
    refresh(novelId, 'chapters'); return c.id;
  });
  if (r.ok) redirect(`/novels/${novelId}/chapters/${r.data}`);
  return r;
}
