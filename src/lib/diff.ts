import { diffWords as jsDiffWords } from 'diff';
export type DiffPart = { value: string; added?: boolean; removed?: boolean };
export const diffWords = (a: string, b: string): DiffPart[] =>
  jsDiffWords(a, b).map((p) => ({ value: p.value, added: p.added || undefined, removed: p.removed || undefined }));
