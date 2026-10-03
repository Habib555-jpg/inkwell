import type { Metadata } from 'next';
import Link from 'next/link';
import { BookText } from 'lucide-react';
import { inArray } from 'drizzle-orm';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listChapters } from '@/server/services/chapters';
import { listCharacters } from '@/server/services/characters';
import { orNotFound } from '@/server/services/novel-page';
import * as s from '@/server/db/schema';
import { StatusBadge } from '@/components/workspace/status-badge';
import { NewChapter } from '@/components/chapters/new-chapter';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Chapters' };

export default async function ChaptersPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const [chapters, characters] = await orNotFound(() => Promise.all([listChapters(db, user.id, novelId), listCharacters(db, user.id, novelId)]));
  const versionIds = chapters.map((c) => c.approvedVersionId ?? c.currentVersionId).filter((x): x is string => !!x);
  const versions = versionIds.length ? await db.select({ id: s.chapterVersions.id, wordCount: s.chapterVersions.wordCount }).from(s.chapterVersions).where(inArray(s.chapterVersions.id, versionIds)) : [];
  const fb = chapters.length ? await db.select({ chapterId: s.chapterFeedback.chapterId, rating: s.chapterFeedback.rating, createdAt: s.chapterFeedback.createdAt })
    .from(s.chapterFeedback).where(inArray(s.chapterFeedback.chapterId, chapters.map((c) => c.id))) : [];
  const latestRating = (id: string) => fb.filter((f) => f.chapterId === id).sort((a, b) => +b.createdAt - +a.createdAt)[0]?.rating;
  const words = (c: (typeof chapters)[number]) => versions.find((v) => v.id === (c.approvedVersionId ?? c.currentVersionId))?.wordCount ?? 0;
  const nextNumber = (chapters.at(-1)?.number ?? 0) + 1;
  const chars = characters.map((c) => ({ id: c.id, name: c.name }));
  return (
    <main className="space-y-6 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Chapters</h1>
          <p className="mt-1 text-sm text-ink-soft">Drafts stay drafts until you approve them. Approved chapters are canon.</p>
        </div>
        <NewChapter novelId={novelId} characters={chars} nextNumber={nextNumber} />
      </header>
      {chapters.length === 0 ? (
        <EmptyState icon={<BookText className="size-5" />} title="No chapters yet" action={<NewChapter novelId={novelId} characters={chars} nextNumber={1} />}>
          Plan chapter one: its main idea, what must and must not happen, and who is involved.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto glass rounded-[var(--radius-card)] border border-line shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Chapter</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Words</th><th className="px-4 py-3 text-right">Last rating</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {chapters.map((c) => {
                const r = latestRating(c.id);
                return (
                  <tr key={c.id} className="hover:bg-sunken">
                    <td className="px-4 py-3 tabular-nums text-ink-faint">{c.number}</td>
                    <td className="px-4 py-3"><Link className="font-medium hover:text-accent" href={`/novels/${novelId}/chapters/${c.id}`}>{c.title || c.mainIdea || 'Untitled'}</Link></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{words(c).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r === undefined ? '—' : `${r}/10`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
