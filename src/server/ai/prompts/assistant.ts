import type { AssistantMode, Prompt } from '../types';
import type { ContextPack } from '../../memory/types';
import { renderContextPack, renderRequirements, WRITING_PRIORITIES } from './context';
import { fence } from './analysis';

const MODE_SYSTEM: Record<AssistantMode, string> = {
  generate: '', revise: '', continuity: '', critic: '',
  brainstorm: 'Brainstorm possible future developments. Offer 5 distinct, specific options that respect canon and the characters. Start your reply with exactly "Ideas (not canon):". Never present an idea as established fact.',
  character: 'Analyze the named character using only the provided memory: personality, voice, relationships, arc so far, and any inconsistencies across chapters. Suggest development opportunities, clearly labeled as suggestions.',
  story_memory: 'Explain plainly what you currently remember about this novel from the provided memory: what is canon, which chapters and facts were retrieved, active writing preferences. Do not invent anything not present.',
};
export function buildAssistantPrompt(mode: AssistantMode, pack: ContextPack, message: string, draft: string | null): Prompt {
  return {
    system: `You are the author's writing partner inside their novel workspace. The author controls canon; you may suggest but never declare new canon.\n${WRITING_PRIORITIES}\n\n${MODE_SYSTEM[mode]}`,
    messages: [{ role: 'user', content: `${renderContextPack(pack)}\n\n${renderRequirements(pack)}${draft ? `\n\n${fence('current_draft', draft.slice(0, 20_000))}` : ''}\n\n${fence('author_message', message)}` }],
  };
}
