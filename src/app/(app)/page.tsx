import type { Metadata } from 'next';
import { Feather } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listNovelSummaries } from '@/server/services/novels';
import { NovelGrid } from '@/components/novels/novel-grid';
import { NewNovelDialog } from '@/components/novels/new-novel-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { RatingTrend } from '@/components/dashboard/rating-trend';
import { UsageCard } from '@/components/dashboard/usage-card';
import { ratingHistory } from '@/server/feedback/service';
import { getUsageSummary } from '@/server/services/usage';
import { getEnv } from '@/server/env';
import Link from 'next/link';
import { Reveal } from '@/components/ui/motion';
import { Particles } from '@/components/ui/particles';
import { Aurora } from '@/components/ui/aurora';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ novel?: string }> }) {
  const user = await requireUser(); const db = await getAppDb();
  const novels = await listNovelSummaries(db, user.id);
  const requested = (await searchParams).novel;
  const focus = novels.find((n) => n.id === requested) ?? novels[0];
  const [history, usage] = await Promise.all([focus ? ratingHistory(db, user.id, focus.id) : Promise.resolve([]), getUsageSummary(db, user.id)]);
  return (
    <main>
      <section className="bg-hero relative overflow-hidden border-b border-line">
        <Aurora className="absolute inset-0 -z-10 opacity-60" amplitude={1.1} colorStops={['#b27c3a', '#6458be', '#9e202c']} />
        <Particles className="absolute inset-0 -z-10" quantity={60} />
        <Reveal className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft/70 px-3 py-1 text-xs font-medium text-accent">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" aria-hidden />Welcome back{user.name ? `, ${user.name}` : ''}
          </p>
          <h1 className="text-gradient mt-4 max-w-3xl pb-1 font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Pick up where the story left off.</h1>
          <p className="mt-4 max-w-2xl text-ink-soft sm:text-lg">Drafts are proposals. Only chapters you approve become canon — and everything Inkwell remembers comes from canon.</p>
        </Reveal>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Your novels</h2>
          {novels.length > 0 && <NewNovelDialog />}
        </div>
        {novels.length > 0 && (
          <Reveal className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="glass rounded-[var(--radius-card)] border border-line p-5 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Ratings · {focus?.title}</h3>
                {novels.length > 1 && (
                  <div className="flex flex-wrap gap-1">{novels.slice(0, 5).map((n) => (
                    <Link key={n.id} href={`/?novel=${n.id}`} className={`rounded-full px-2.5 py-1 text-xs ${n.id === focus?.id ? 'bg-brand text-white shadow-glow' : 'bg-sunken text-ink-soft hover:text-ink'} transition-all`}>{n.title}</Link>
                  ))}</div>
                )}
              </div>
              <RatingTrend data={history.map((h) => ({ chapterNumber: h.chapterNumber, title: h.title, versions: h.versions.map((v) => ({ versionNumber: v.versionNumber, rating: v.rating })), approvedRating: h.approvedRating }))} />
            </div>
            <UsageCard usage={usage} provider={getEnv().AI_PROVIDER} />
          </Reveal>
        )}
        {novels.length ? <NovelGrid novels={novels} /> : (
          <EmptyState icon={<Feather className="size-5" />} title="Your desk is clear" action={<NewNovelDialog trigger="hero" />}>
            Start a novel to set up its world, characters and rules.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
