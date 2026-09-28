import { z } from 'zod';
const cat = z.enum(['magic', 'technology', 'history', 'rule', 'term', 'other']);
const ent = z.object({ name: z.string(), description: z.string().optional() });
export const extractedFactsSchema = z.object({
  characters: z.array(z.object({ name: z.string(), description: z.string().optional(), status: z.string().optional(), locationName: z.string().optional(), evidence: z.string().optional() })).default([]),
  locations: z.array(ent).default([]), factions: z.array(ent).default([]), objects: z.array(ent).default([]),
  worldRules: z.array(z.object({ name: z.string(), category: cat.catch('other'), description: z.string() })).default([]),
  events: z.array(z.object({ description: z.string(), characterNames: z.array(z.string()).default([]), locationName: z.string().optional(), importance: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(2) })).default([]),
  relationships: z.array(z.object({ from: z.string(), to: z.string(), type: z.string(), description: z.string().optional(), isSecret: z.boolean().optional(), evidence: z.string().optional() })).default([]),
  revelations: z.array(z.string()).default([]),
});
export const scopeSchema = z.enum(['chapter', 'character', 'story', 'global']);
export const revisionItemSchema = z.object({
  id: z.string(), change: z.string(), rationale: z.string(),
  action: z.enum(['remove', 'add', 'rewrite', 'dialogue_casual', 'dialogue_formal', 'shorten_description', 'expand_description', 'more_internal_monologue', 'fix_continuity', 'other']).catch('other'),
  target: z.string().optional(), characterId: z.string().optional(), scope: scopeSchema.catch('chapter'),
  status: z.enum(['pending', 'accepted', 'rejected']).catch('pending'),
});
export const feedbackAnalysisSchema = z.object({
  items: z.array(revisionItemSchema).default([]),
  themes: z.array(z.object({ themeKey: z.string(), scope: scopeSchema, characterId: z.string().optional(), statement: z.string() })).default([]),
  summary: z.string().default(''),
});
export const issuesSchema = z.object({
  issues: z.array(z.object({
    severity: z.enum(['info', 'warning', 'error']).catch('warning'), category: z.string(), message: z.string(),
    evidence: z.object({ chapterNumber: z.number().optional(), quote: z.string().optional(), draftQuote: z.string().optional() }).optional(),
    characterId: z.string().optional(),
  })).default([]),
});
