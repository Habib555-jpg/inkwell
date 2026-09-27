import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listNovelSummaries } from '@/server/services/novels';
import { NovelGrid } from '@/components/novels/novel-grid';
import { NewNovelDialog } from '@/components/novels/new-novel-dialog';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Novels' };

export default async function NovelsPage() {
  const user = await requireUser();
  const novels = await listNovelSummaries(await getAppDb(), user.id);
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Your novels</h1>
          <p className="mt-1 text-sm text-ink-soft">Each novel keeps its own memory, canon and writing preferences.</p>
        </div>
        <NewNovelDialog />
      </div>
      {novels.length ? <NovelGrid novels={novels} /> : (
        <EmptyState icon={<BookOpen className="size-5" />} title="No novels yet" action={<NewNovelDialog trigger="hero" />}>
          Create your first novel, describe its world and characters, then write chapter one together.
        </EmptyState>
      )}
    </main>
  );
}
