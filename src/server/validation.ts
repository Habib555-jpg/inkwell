import { z, type ZodType } from 'zod';
import { ValidationError } from './errors';

export const shortText = z.string().trim().max(200);
export const longText = z.string().max(20_000);
export const uuidSchema = z.string().uuid();
export const chapterContent = z.string().max(200_000);

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new ValidationError(`${first.path.join('.') || 'input'}: ${first.message}`, r.error.issues);
  }
  return r.data;
}
export const isUuid = (v: string) => uuidSchema.safeParse(v).success;

export const novelInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  genre: shortText.optional(),
  premise: longText.optional(),
  setting: longText.optional(),
  writingStyle: longText.optional(),
  tone: shortText.optional(),
  targetChapterWords: z.number().int().min(300).max(20_000).optional(),
  rulesText: longText.optional(),
  notes: longText.optional(),
});
export type NovelInput = z.infer<typeof novelInputSchema>;

export const novelSettingsSchema = z.object({
  dialogueBalance: z.enum(['dialogue_heavy', 'balanced', 'narration_heavy']).optional(),
  pov: shortText.optional(),
  tense: z.enum(['past', 'present']).optional(),
  aiModel: shortText.nullable().optional(),
  retrievalTopK: z.number().int().min(1).max(30).optional(),
  contextTokenBudget: z.number().int().min(1500).max(60_000).optional(),
});
