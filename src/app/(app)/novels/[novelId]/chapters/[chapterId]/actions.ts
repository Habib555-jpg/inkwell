'use server';
import { revalidatePath } from 'next/cache';
import { getAppContext } from '@/server/context';
import { requireUserForAction } from '@/server/auth/session';
import { runAction } from '@/app/_actions/result';
import { generateDraft } from '@/server/pipeline/generate';
import { checkVersion } from '@/server/pipeline/checks';
import { autosaveVersion, restoreVersion, deleteVersion, setCurrentVersion, compareVersions, getVersion, saveManualVersion } from '@/server/services/versions';
import { updateChapter, type ChapterRequirementsInput } from '@/server/services/chapters';
import { submitFeedback, updateProposalItems, applyProposal, proposeFromCritic, getProposal } from '@/server/feedback/service';
import { approveVersion, retryExtraction } from '@/server/canon/approve';
import { getVersionForUser } from '@/server/services/access';

async function base() { const user = await requireUserForAction(); const ctx = await getAppContext(); return { user, ctx }; }
const refresh = (novelId: string, chapterId: string) => { revalidatePath(`/novels/${novelId}/chapters/${chapterId}`); revalidatePath(`/novels/${novelId}/chapters`); revalidatePath(`/novels/${novelId}/memory`); };

export const generateAction = async (chapterId: string) => runAction(async () => {
  const { user, ctx } = await base(); const { version } = await generateDraft(ctx, user.id, chapterId);
  refresh(version.novelId, chapterId); return { versionId: version.id };
});
export const autosaveAction = async (versionId: string, content: string) => runAction(async () => {
  const { user, ctx } = await base(); const r = await autosaveVersion(ctx.db, user.id, versionId, content);
  if (r.forked) refresh(r.version.novelId, r.version.chapterId);
  return { versionId: r.version.id, forked: r.forked, versionNumber: r.version.versionNumber, savedAt: r.version.updatedAt.toISOString(), wordCount: r.version.wordCount };
});
export const saveRequirementsAction = async (chapterId: string, patch: ChapterRequirementsInput) => runAction(async () => {
  const { user, ctx } = await base(); const c = await updateChapter(ctx.db, user.id, chapterId, patch); refresh(c.novelId, chapterId); return null;
});
export const setCurrentAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); await setCurrentVersion(ctx.db, user.id, versionId);
  const { chapter } = await getVersionForUser(ctx.db, user.id, versionId); refresh(chapter.novelId, chapter.id); return null;
});
export const restoreAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); const v = await restoreVersion(ctx.db, user.id, versionId); refresh(v.novelId, v.chapterId); return { versionId: v.id };
});
export const deleteVersionAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); const { chapter } = await getVersionForUser(ctx.db, user.id, versionId);
  await deleteVersion(ctx.db, user.id, versionId); refresh(chapter.novelId, chapter.id); return null;
});
export const compareAction = async (a: string, b: string) => runAction(async () => {
  const { user, ctx } = await base(); const r = await compareVersions(ctx.db, user.id, a, b);
  return { a: { versionNumber: r.a.versionNumber }, b: { versionNumber: r.b.versionNumber }, diff: r.diff };
});
export const getVersionAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); const v = await getVersion(ctx.db, user.id, versionId);
  return { id: v.id, content: v.content, versionNumber: v.versionNumber, source: v.source, isCanon: v.isCanon, continuityReport: v.continuityReport, criticReport: v.criticReport, generationMeta: v.generationMeta };
});
export const submitFeedbackAction = async (input: Parameters<typeof submitFeedback>[2]) => runAction(async () => {
  const { user, ctx } = await base(); const r = await submitFeedback(ctx, user.id, input);
  refresh(r.feedback.novelId, r.feedback.chapterId); return { feedbackId: r.feedback.id, proposal: r.proposal, summary: r.analysis.summary };
});
export const updateProposalAction = async (proposalId: string, updates: Parameters<typeof updateProposalItems>[3]) => runAction(async () => {
  const { user, ctx } = await base(); return updateProposalItems(ctx.db, user.id, proposalId, updates);
});
export const applyProposalAction = async (proposalId: string) => runAction(async () => {
  const { user, ctx } = await base(); const v = await applyProposal(ctx, user.id, proposalId); refresh(v.novelId, v.chapterId);
  return { versionId: v.id, notApplied: (v.generationMeta as { notApplied?: { change: string }[] }).notApplied ?? [] };
});
export const improveAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); return proposeFromCritic(ctx, user.id, versionId);
});
export const checkAction = async (versionId: string) => runAction(async () => {
  const { user, ctx } = await base(); return checkVersion(ctx, user.id, versionId);
});
export const approveAction = async (versionId: string, expectedUpdatedAt?: string) => runAction(async () => {
  const { user, ctx } = await base(); const r = await approveVersion(ctx, user.id, versionId, { expectedUpdatedAt });
  const { chapter } = await getVersionForUser(ctx.db, user.id, versionId); refresh(chapter.novelId, chapter.id); return r;
});
export const retryExtractionAction = async (chapterId: string) => runAction(async () => {
  const { user, ctx } = await base(); const r = await retryExtraction(ctx, user.id, chapterId); return r;
});
export const getProposalAction = async (proposalId: string) => runAction(async () => {
  const { user, ctx } = await base(); const p = await getProposal(ctx.db, user.id, proposalId);
  return { id: p.id, source: p.source, baseVersionId: p.baseVersionId, items: p.items };
});
/** Autosave fallback when the edited version is gone or no longer editable: keep the text as a new manual version. */
export const saveAsNewVersionAction = async (chapterId: string, content: string) => runAction(async () => {
  const { user, ctx } = await base(); const v = await saveManualVersion(ctx.db, user.id, chapterId, content);
  refresh(v.novelId, chapterId);
  return { versionId: v.id, versionNumber: v.versionNumber, savedAt: v.updatedAt.toISOString() };
});
