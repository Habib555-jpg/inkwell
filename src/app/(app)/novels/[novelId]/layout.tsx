import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { getNovel } from '@/server/services/novels';
import { listChapters } from '@/server/services/chapters';
import { orNotFound } from '@/server/services/novel-page';
import * as s from '@/server/db/schema';
import { NovelNav } from '@/components/novel-nav';

export default async function NovelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser();
  const db = await getAppDb();
  const { novel } = await orNotFound(() => getNovel(db, user.id, novelId));
  const chapters = await listChapters(db, user.id, novelId);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.memoryConflicts)
    .where(and(eq(s.memoryConflicts.novelId, novelId), eq(s.memoryConflicts.status, 'open')));
  return (
    <div className="mx-auto flex max-w-[1600px]">
      <NovelNav novel={{ id: novel.id, title: novel.title }} chapters={chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status }))} openConflicts={Number(n)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
