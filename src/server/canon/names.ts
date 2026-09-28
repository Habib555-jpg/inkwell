import { normalizeApostrophes } from '../text/tokenize';
const norm = (s: string) => normalizeApostrophes(s).trim().toLowerCase().replace(/^the\s+/, '');
export function makeResolver<T extends { id: string; name: string; aliases?: string[] }>(rows: T[], opts: { firstNames?: boolean } = {}) {
  const map = new Map<string, T>(); const firstCount = new Map<string, number>();
  if (opts.firstNames) for (const r of rows) { const f = norm(r.name.split(/\s+/)[0]); firstCount.set(f, (firstCount.get(f) ?? 0) + 1); }
  for (const r of rows) {
    map.set(norm(r.name), r);
    for (const a of r.aliases ?? []) map.set(norm(a), r);
    if (opts.firstNames) { const f = norm(r.name.split(/\s+/)[0]); if (firstCount.get(f) === 1 && !map.has(f)) map.set(f, r); }
  }
  return (name: string) => map.get(norm(name));
}
