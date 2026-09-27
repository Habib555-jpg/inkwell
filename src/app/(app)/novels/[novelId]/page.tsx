import Link from 'next/link';
import { ArrowRight, BookText, Brain, CheckCircle2, Users } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { getNovel, listNovelSummaries } from '@/server/services/novels';
import { listChapters } from '@/server/services/chapters';
import { listCharacters } from '@/server/services/characters';
import { orNotFound } from '@/server/services/novel-page';
import { Card, CardHeader } from '@/components/ui/card';
import { NovelProfileForm } from '@/components/novels/novel-profile-form';
import { StatusBadge } from '@/components/workspace/status-badge';

export default async function NovelOverview({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const { novel } = await orNotFound(() => getNovel(db, user.id, novelId));
  const [chapters, characters, summaries] = await Promise.all([listChapters(db, user.id, novelId), listCharacters(db, user.id, novelId), listNovelSummaries(db, user.id)]);
  const summary = summaries.find((x) => x.id === novelId)!;
  const stats = [
    { label: 'Chapters', value: summary.chapterCount, icon: BookText },
    { label: 'Canon', value: summary.canonCount, icon: CheckCircle2 },
    { label: 'Characters', value: characters.length, icon: Users },
    { label: 'Conflicts to review', value: summary.openConflicts, icon: Brain },
  ];
  const next = chapters.find((c) => c.status !== 'approved') ?? null;
  return (
    <main className="space-y-8 px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Novel workspace</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{novel.title}</h1>
        </div>
        <Link href={next ? `/novels/${novelId}/chapters/${next.id}` : `/novels/${novelId}/chapters`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 text-sm font-medium text-accent-ink shadow-card hover:shadow-lift">
          {next ? `Continue chapter ${next.number}` : 'Plan the next chapter'} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <li key={label} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <Icon className="size-4 text-accent" aria-hidden />
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-ink-faint">{label}</p>
          </li>
        ))}
      </ul>
      {chapters.length > 0 && (
        <Card>
          <CardHeader title="Recent chapters" />
          <ul className="divide-y divide-line">
            {chapters.slice(-5).reverse().map((c) => (
              <li key={c.id}>
                <Link href={`/novels/${novelId}/chapters/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken">
                  <span className="w-10 tabular-nums text-ink-faint">{c.number}.</span>
                  <span className="flex-1 truncate">{c.title || c.mainIdea || 'Untitled'}</span>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Novel profile" description="Permanent information every chapter draws on (memory layer 1)." />
        <div className="p-5">
          <NovelProfileForm novelId={novelId} initial={{
            title: novel.title, genre: novel.genre, premise: novel.premise, setting: novel.setting, writingStyle: novel.writingStyle,
            tone: novel.tone, targetChapterWords: novel.targetChapterWords, rulesText: novel.rulesText, notes: novel.notes,
          }} />
        </div>
      </Card>
    </main>
  );
}
