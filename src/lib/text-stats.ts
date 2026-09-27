export const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/u).length : 0);
