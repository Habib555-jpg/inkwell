import type { FeedbackAnalysisInput, Prompt } from '../types';
import { THEMES } from '../../feedback/themes';
import { fence } from './analysis';
export function buildFeedbackPrompt(input: FeedbackAnalysisInput): Prompt {
  return {
    system: [
      'You turn an author\'s chapter feedback into concrete revision proposals and classified preference signals.',
      'Each item: one concrete change with rationale and action (remove|add|rewrite|dialogue_casual|dialogue_formal|shorten_description|expand_description|more_internal_monologue|fix_continuity|other).',
      'Scope each statement as exactly one of: chapter (only about this chapter), character (about one character; set characterId from the list), story (novel-level plot/content direction), global (writing style the author wants everywhere).',
      'Be conservative: a complaint about one scene is chapter scope. Only clearly general style statements are global.',
      `themes: use these keys when they fit: ${Object.keys(THEMES).join(', ')}. Omit themes for praise.`,
      'Never create items from praise.',
    ].join('\n'),
    messages: [{ role: 'user', content: `${fence('characters', JSON.stringify(input.characters))}\nRating: ${input.rating}/10 for chapter ${input.chapterNumber}\n${fence('feedback', JSON.stringify(input.answers, null, 2))}` }],
  };
}
