import { requireUser } from '@/server/auth/session';
import { getAppDb } from '@/server/context';
import { getNovel } from '@/server/services/novels';
import { orNotFound } from '@/server/services/novel-page';
import { Card, CardHeader } from '@/components/ui/card';
import { NovelSettingsForm } from '@/components/novels/novel-settings-form';
import { DeleteNovelButton } from '@/components/novels/delete-novel-button';

export default async function NovelSettingsPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const user = await requireUser();
  const { novel, settings } = await orNotFound(async () => getNovel(await getAppDb(), user.id, novelId));
  return (
    <main className="max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Novel settings</h1>
      <Card>
        <CardHeader title="Writing & retrieval" description="Applies to every chapter of this novel." />
        <div className="p-5">
          <NovelSettingsForm novelId={novelId} initial={{
            dialogueBalance: settings.dialogueBalance, pov: settings.pov, tense: settings.tense, aiModel: settings.aiModel,
            retrievalTopK: settings.retrievalTopK, contextTokenBudget: settings.contextTokenBudget,
          }} />
        </div>
      </Card>
      <Card className="border-changed/30">
        <CardHeader title="Danger zone" description="Deleting a novel removes its chapters, canon and memory permanently." action={<DeleteNovelButton novelId={novelId} title={novel.title} />} />
      </Card>
    </main>
  );
}
