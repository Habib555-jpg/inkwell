import { createHash } from 'node:crypto';
export const contentHash = (text: string) => createHash('sha256').update(text).digest('hex');
