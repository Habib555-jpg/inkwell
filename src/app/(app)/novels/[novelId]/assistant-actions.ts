'use server';
import { getAppContext } from '@/server/context';
import { requireUserForAction } from '@/server/auth/session';
import { runAction } from '@/app/_actions/result';
import { runAssistant, listConversation } from '@/server/assistant/service';
export const assistantAction = async (input: Parameters<typeof runAssistant>[2]) => runAction(async () => {
  const user = await requireUserForAction(); return runAssistant(await getAppContext(), user.id, input);
});
export const conversationAction = async (id: string) => runAction(async () => {
  const user = await requireUserForAction(); const ctx = await getAppContext(); return listConversation(ctx.db, user.id, id);
});
