import type { Metadata } from 'next';
import { Feather } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listNovelSummaries } from '@/server/services/novels';
import { NovelGrid } from '@/components/novels/novel-grid';
import { NewNovelDialog } from '@/components/novels/new-novel-dialog';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const user = await requireUser();
  const novels = await listNovelSummaries(await getAppDb(), user.id);
  return (
    <main>
      <section className="bg-hero border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-medium text-accent">Welcome back{user.name ? `, ${user.name}` : ''}</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Pick up where the story left off.</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">Drafts are proposals. Only chapters you approve become canon — and everything Inkwell remembers comes from canon.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novels</h2>
          {novels.length > 0 && <NewNovelDialog />}
        </div>
        {novels.length ? <NovelGrid novels={novels} /> : (
          <EmptyState icon={<Feather className="size-5" />} title="Your desk is clear" action={<NewNovelDialog trigger="hero" />}>
            Start a novel to set up its world, characters and rules.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
