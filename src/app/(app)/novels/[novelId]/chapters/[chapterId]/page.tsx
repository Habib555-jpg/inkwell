import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/session';
import { getAppContext } from '@/server/context';
import { getChapterDetail } from '@/server/services/chapters';
import { getVersion } from '@/server/services/versions';
import { listCharacters } from '@/server/services/characters';
import { describeIncluded } from '@/server/memory/describe';
import { listConflicts } from '@/server/canon/conflicts';
import { listFeedback } from '@/server/feedback/service';
import { orNotFound } from '@/server/services/novel-page';
import { ChapterWorkspace } from '@/components/workspace/chapter-workspace';
import type { GenerationMeta, WsVersion } from '@/components/workspace/types';

export const metadata: Metadata = { title: 'Chapter' };

export default async function ChapterPage({ params }: { params: Promise<{ novelId: string; chapterId: string }> }) {
  const { novelId, chapterId } = await params;
  const user = await requireUser(); const ctx = await getAppContext();
  const data = await orNotFound(async () => {
    const { chapter, versions } = await getChapterDetail(ctx.db, user.id, chapterId);
    const current = chapter.currentVersionId ? await getVersion(ctx.db, user.id, chapter.currentVersionId) : null;
    const meta = (current?.generationMeta ?? {}) as GenerationMeta;
    const [characters, conflicts, feedback, memoryUsed] = await Promise.all([
      listCharacters(ctx.db, user.id, novelId), listConflicts(ctx.db, user.id, novelId),
      listFeedback(ctx.db, user.id, chapterId), describeIncluded(ctx.db, novelId, meta.included ?? []),
    ]);
    return { chapter, versions, current, meta, characters, conflicts, feedback, memoryUsed };
  });
  const { chapter, versions, current, meta, characters, conflicts, feedback, memoryUsed } = data;
  if (chapter.novelId !== novelId) notFound();
  const ws: WsVersion | null = current && {
    id: current.id, versionNumber: current.versionNumber, source: current.source, isCanon: current.isCanon, content: current.content, wordCount: current.wordCount,
    generationMeta: meta, continuityReport: current.continuityReport as WsVersion['continuityReport'], criticReport: current.criticReport as WsVersion['criticReport'],
  };
  return (
    <ChapterWorkspace novelId={novelId} chapter={chapter} versions={versions} current={ws}
      characters={characters.map((c) => ({ id: c.id, name: c.name }))}
      openConflicts={conflicts.filter((c) => c.chapterVersionId === chapter.approvedVersionId).length}
      feedback={feedback.map((f) => ({ id: f.id, chapterVersionId: f.chapterVersionId, rating: f.rating, createdAt: f.createdAt, whatDidnt: f.whatDidnt, changesRequested: f.changesRequested }))}
      memoryUsed={memoryUsed} provider={ctx.ai.id} />
  );
}
