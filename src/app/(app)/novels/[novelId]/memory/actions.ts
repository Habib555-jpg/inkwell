'use server';
import { revalidatePath } from 'next/cache';
import { getAppContext } from '@/server/context';
import { requireUserForAction } from '@/server/auth/session';
import { runAction } from '@/app/_actions/result';
import { resolveConflict } from '@/server/canon/conflicts';
import { updateSummary, deleteChunk, deleteFact } from '@/server/canon/memory';
import { updateVoiceProfile, resetVoiceField, type VoicePatch, type LOCKABLE_FIELDS } from '@/server/voice/profile';
import { setPreferenceStatus, updatePreference, createPreference, deletePreference, resolveVoiceNote } from '@/server/feedback/preferences';
import { reembedNovel } from '@/server/memory/index-canon';
import { retryExtraction } from '@/server/canon/approve';

async function base() { const user = await requireUserForAction(); const ctx = await getAppContext(); return { user, ctx }; }
const refresh = (novelId: string) => { revalidatePath(`/novels/${novelId}/memory`); revalidatePath(`/novels/${novelId}`, 'layout'); };

export async function resolveConflictAction(novelId: string, id: string, decision: 'keep_existing' | 'accept_new' | 'merge', merged?: string) {
  return runAction(async () => { const { user, ctx } = await base(); await resolveConflict(ctx.db, user.id, id, decision, merged); refresh(novelId); return null; });
}
export async function updateVoiceAction(novelId: string, characterId: string, patch: VoicePatch) {
  return runAction(async () => { const { user, ctx } = await base(); await updateVoiceProfile(ctx.db, user.id, characterId, patch); refresh(novelId); revalidatePath(`/novels/${novelId}/characters`); return null; });
}
export async function resetVoiceFieldAction(novelId: string, characterId: string, field: (typeof LOCKABLE_FIELDS)[number]) {
  return runAction(async () => { const { user, ctx } = await base(); await resetVoiceField(ctx.db, user.id, characterId, field); refresh(novelId); revalidatePath(`/novels/${novelId}/characters`); return null; });
}
export async function setPreferenceStatusAction(novelId: string, id: string, status: 'candidate' | 'active' | 'dismissed') {
  return runAction(async () => { const { user, ctx } = await base(); await setPreferenceStatus(ctx.db, user.id, id, status); refresh(novelId); return null; });
}
export async function updatePreferenceAction(novelId: string, id: string, patch: { statement?: string; pinned?: boolean }) {
  return runAction(async () => { const { user, ctx } = await base(); await updatePreference(ctx.db, user.id, id, patch); refresh(novelId); return null; });
}
export async function createPreferenceAction(novelId: string, input: { scope: 'global' | 'story' | 'character'; statement: string; characterId?: string }) {
  return runAction(async () => { const { user, ctx } = await base(); await createPreference(ctx.db, user.id, novelId, input); refresh(novelId); return null; });
}
export async function deletePreferenceAction(novelId: string, id: string) {
  return runAction(async () => { const { user, ctx } = await base(); await deletePreference(ctx.db, user.id, id); refresh(novelId); return null; });
}
export async function resolveVoiceNoteAction(novelId: string, id: string, accept: boolean) {
  return runAction(async () => { const { user, ctx } = await base(); await resolveVoiceNote(ctx.db, user.id, id, accept); refresh(novelId); return null; });
}
export async function updateSummaryAction(novelId: string, id: string, summary: string) {
  return runAction(async () => { const { user, ctx } = await base(); await updateSummary(ctx.db, user.id, id, summary); refresh(novelId); return null; });
}
export async function deleteChunkAction(novelId: string, id: string) {
  return runAction(async () => { const { user, ctx } = await base(); await deleteChunk(ctx.db, user.id, id); refresh(novelId); return null; });
}
export async function deleteFactAction(novelId: string, id: string) {
  return runAction(async () => { const { user, ctx } = await base(); await deleteFact(ctx.db, user.id, id); refresh(novelId); return null; });
}
export async function reindexAction(novelId: string) {
  return runAction(async () => { const { user, ctx } = await base(); const r = await reembedNovel(ctx, user.id, novelId); refresh(novelId); return r; });
}
export async function retryExtractionAction(novelId: string, chapterId: string) {
  return runAction(async () => { const { user, ctx } = await base(); const r = await retryExtraction(ctx, user.id, chapterId); refresh(novelId); return r; });
}
