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
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { Shimmer } from '@/components/ui/shimmer';
import { Spotlight } from '@/components/ui/spotlight';
import { Particles } from '@/components/ui/particles';
import { Aurora } from '@/components/ui/aurora';

export default async function NovelOverview({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const { novel } = await orNotFound(() => getNovel(db, user.id, novelId));
  const [chapters, characters, summaries] = await Promise.all([listChapters(db, user.id, novelId), listCharacters(db, user.id, novelId), listNovelSummaries(db, user.id)]);
  const summary = summaries.find((x) => x.id === novelId)!;
  const stats = [
    { label: 'Chapters', value: summary.chapterCount, icon: BookText, tint: 'from-accent/25 text-accent' },
    { label: 'Canon', value: summary.canonCount, icon: CheckCircle2, tint: 'from-canon/25 text-canon' },
    { label: 'Characters', value: characters.length, icon: Users, tint: 'from-sky/25 text-sky' },
    { label: 'Conflicts to review', value: summary.openConflicts, icon: Brain, tint: 'from-changed/25 text-changed' },
  ];
  const next = chapters.find((c) => c.status !== 'approved') ?? null;
  return (
    <main className="space-y-8 px-4 py-8 lg:px-8">
      <Reveal>
        <header className="glass bg-hero relative overflow-hidden rounded-3xl border border-line px-6 py-8 shadow-card sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-accent/20 blur-3xl" aria-hidden />
          <Aurora className="absolute inset-0 opacity-35" colorStops={['#b27c3a', '#6458be', '#9e202c']} />
          <Particles className="absolute inset-0" quantity={40} />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-strong">Novel workspace</p>
              <h1 className="text-gradient mt-2 pb-1 font-serif text-4xl font-semibold capitalize leading-tight tracking-tight sm:text-5xl">{novel.title}</h1>
              {(novel.genre || novel.tone) && <p className="mt-1 text-sm text-ink-soft">{[novel.genre, novel.tone].filter(Boolean).join(' · ')}</p>}
            </div>
            <Link href={next ? `/novels/${novelId}/chapters/${next.id}` : `/novels/${novelId}/chapters`}
              className="bg-brand group relative z-0 inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-medium text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.97]">
              <Shimmer />
              {next ? `Continue chapter ${next.number}` : 'Plan the next chapter'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </header>
      </Reveal>
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint }) => (
          <StaggerItem key={label} lift className="glass overflow-hidden rounded-[var(--radius-card)] border border-line shadow-card transition-shadow hover:shadow-lift">
            <Spotlight className="p-5">
            <div className={`grid size-9 place-items-center rounded-xl bg-gradient-to-br to-transparent ${tint}`}><Icon className="size-4" aria-hidden /></div>
            <p className="mt-3 font-serif text-3xl font-semibold tabular-nums"><CountUp value={value} /></p>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</p>
            </Spotlight>
          </StaggerItem>
        ))}
      </Stagger>
      {chapters.length > 0 && (
        <Card>
          <CardHeader title="Recent chapters" />
          <ul className="divide-y divide-line">
            {chapters.slice(-5).reverse().map((c) => (
              <li key={c.id}>
                <Link href={`/novels/${novelId}/chapters/${c.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent-soft/50">
                  <span className="w-10 tabular-nums text-ink-faint">{c.number}.</span>
                  <span className="flex-1 truncate transition-colors group-hover:text-accent">{c.title || c.mainIdea || 'Untitled'}</span>
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
