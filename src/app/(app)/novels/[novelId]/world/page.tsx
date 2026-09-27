import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listWorldEntities } from '@/server/services/world';
import { chapterNumbersForVersions } from '@/server/services/chapters';
import { orNotFound } from '@/server/services/novel-page';
import { WorldTabs } from '@/components/bible/world-tabs';
import { saveWorldEntityAction, deleteWorldEntityAction } from '../bible-actions';

export const metadata: Metadata = { title: 'World' };

export default async function WorldPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const [location, faction, world_rule, story_object] = await orNotFound(() => Promise.all(
    (['location', 'faction', 'world_rule', 'story_object'] as const).map((k) => listWorldEntities(db, user.id, novelId, k))));
  const src = await chapterNumbersForVersions(db, novelId, [...location, ...faction, ...world_rule, ...story_object].map((x) => x.sourceChapterVersionId));
  const withSrc = (xs: typeof location) => xs.map((x) => ({ ...x, sourceChapterNumber: x.sourceChapterVersionId ? src.get(x.sourceChapterVersionId) ?? null : null }));
  return (
    <main className="space-y-6 px-4 py-8 lg:px-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">World</h1>
        <p className="mt-1 text-sm text-ink-soft">Places, powers, factions and objects. Chapters are checked against these rules.</p>
      </header>
      <WorldTabs items={{ location: withSrc(location), faction: withSrc(faction), world_rule: withSrc(world_rule), story_object: withSrc(story_object) }}
        onSave={saveWorldEntityAction.bind(null, novelId)} onDelete={deleteWorldEntityAction.bind(null, novelId)} />
    </main>
  );
}
