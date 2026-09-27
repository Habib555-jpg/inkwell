import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listTimeline } from '@/server/services/timeline';
import { listCharacters } from '@/server/services/characters';
import { chapterNumbersForVersions } from '@/server/services/chapters';
import { orNotFound } from '@/server/services/novel-page';
import { TimelineEditor } from '@/components/bible/timeline-editor';
import { saveTimelineEventAction, deleteTimelineEventAction } from '../bible-actions';

export const metadata: Metadata = { title: 'Timeline' };

export default async function TimelinePage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const [events, characters] = await orNotFound(() => Promise.all([listTimeline(db, user.id, novelId), listCharacters(db, user.id, novelId)]));
  const src = await chapterNumbersForVersions(db, novelId, events.map((e) => e.sourceChapterVersionId));
  return (
    <main className="space-y-6 px-4 py-8 lg:px-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Timeline</h1>
        <p className="mt-1 text-sm text-ink-soft">The chronological record of canon. New chapters are checked against it.</p>
      </header>
      <TimelineEditor events={events.map((e) => ({ ...e, sourceChapterNumber: e.sourceChapterVersionId ? src.get(e.sourceChapterVersionId) ?? null : null }))}
        characters={characters.map((c) => ({ id: c.id, name: c.name }))}
        onSave={saveTimelineEventAction.bind(null, novelId)} onDelete={deleteTimelineEventAction.bind(null, novelId)} />
    </main>
  );
}
