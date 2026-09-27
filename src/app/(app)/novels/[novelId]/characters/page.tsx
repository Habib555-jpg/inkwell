import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { listCharacters } from '@/server/services/characters';
import { listRelationships } from '@/server/services/relationships';
import { chapterNumbersForVersions } from '@/server/services/chapters';
import { orNotFound } from '@/server/services/novel-page';
import { EntityEditor } from '@/components/bible/entity-editor';
import { RelationshipsEditor } from '@/components/bible/relationships-editor';
import { characterFields } from '@/components/bible/fields';
import { saveCharacterAction, deleteCharacterAction, saveRelationshipAction, deleteRelationshipAction } from '../bible-actions';

export const metadata: Metadata = { title: 'Characters' };

export default async function CharactersPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser(); const db = await getAppDb();
  const [characters, relationships] = await orNotFound(() => Promise.all([listCharacters(db, user.id, novelId), listRelationships(db, user.id, novelId, { includeInactive: true })]));
  const src = await chapterNumbersForVersions(db, novelId, [...characters, ...relationships].map((x) => x.sourceChapterVersionId));
  const withSrc = <T extends { sourceChapterVersionId: string | null }>(x: T) => ({ ...x, sourceChapterNumber: x.sourceChapterVersionId ? src.get(x.sourceChapterVersionId) ?? null : null });
  return (
    <main className="space-y-6 px-4 py-8 lg:px-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Characters</h1>
        <p className="mt-1 text-sm text-ink-soft">Personality, speech and state. Voice profiles learn from approved dialogue; your edits always win.</p>
      </header>
      <EntityEditor title="Characters" noun="Character" fields={characterFields} emptyIcon={<Users className="size-5" />}
        items={characters.map(withSrc)} onSave={saveCharacterAction.bind(null, novelId)} onDelete={deleteCharacterAction.bind(null, novelId)} />
      <RelationshipsEditor characters={characters.map((c) => ({ id: c.id, name: c.name }))} relationships={relationships.map(withSrc)}
        onSave={saveRelationshipAction.bind(null, novelId)} onDelete={deleteRelationshipAction.bind(null, novelId)} />
    </main>
  );
}
