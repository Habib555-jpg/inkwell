'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { requireUserForAction } from '@/server/auth/session';
import { createNovel, updateNovel, updateNovelSettings, deleteNovel } from '@/server/services/novels';
import { createCharacter } from '@/server/services/characters';
import { runAction } from '../../_actions/result';
import type { NovelInput } from '@/server/validation';

export async function createNovelAction(input: NovelInput & { characters?: { name: string; personality?: string }[] }) {
  const r = await runAction(async () => {
    const user = await requireUserForAction(); const db = await getDb();
    const { characters = [], ...novel } = input;
    const n = await createNovel(db, user.id, novel);
    for (const c of characters.filter((c) => c.name.trim())) await createCharacter(db, user.id, n.id, c);
    return n.id;
  });
  if (r.ok) redirect(`/novels/${r.data}`);
  return r;
}
export async function updateNovelAction(novelId: string, patch: Partial<NovelInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const n = await updateNovel(await getDb(), user.id, novelId, patch);
    revalidatePath(`/novels/${novelId}`);
    return n;
  });
}
export async function updateNovelSettingsAction(novelId: string, patch: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const st = await updateNovelSettings(await getDb(), user.id, novelId, patch);
    revalidatePath(`/novels/${novelId}/settings`);
    return st;
  });
}
export async function deleteNovelAction(novelId: string) {
  const r = await runAction(async () => { const user = await requireUserForAction(); await deleteNovel(await getDb(), user.id, novelId); return null; });
  if (r.ok) redirect('/novels');
  return r;
}
