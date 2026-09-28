import type { DB } from '../db/types';
import type { FeedbackTheme } from '../ai/types';
export async function afterFeedbackThemes(_db: DB, _novelId: string, _feedbackId: string, _themes: FeedbackTheme[]): Promise<void> {}
