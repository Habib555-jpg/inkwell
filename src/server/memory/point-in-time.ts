import { and, asc, eq, gte } from 'drizzle-orm';
import * as s from '../db/schema';
import type { DB } from '../db/types';

export type StateAt = { currentStatus?: string; currentLocationId?: string | null };

/**
 * Character state as of the start of chapter N. State changes extracted from chapters ≥ N are recorded as
 * `character_state` facts with their `from` value, so the earliest such fact per character and field
 * tells us what the value was before chapter N. Values the user set directly (no fact) are kept as-is.
 */
export async function characterStateBefore(db: DB, novelId: string, chapterNumber: number): Promise<Map<string, StateAt>> {
  const facts = await db.select().from(s.chapterFacts)
    .where(and(eq(s.chapterFacts.novelId, novelId), eq(s.chapterFacts.kind, 'character_state'), gte(s.chapterFacts.chapterNumber, chapterNumber)))
    .orderBy(asc(s.chapterFacts.chapterNumber), asc(s.chapterFacts.createdAt));
  const out = new Map<string, StateAt>();
  for (const f of facts) {
    if (!f.entityId) continue;
    const { field, from } = JSON.parse(f.content) as { field: 'currentStatus' | 'currentLocationId'; from: string | null };
    const st = out.get(f.entityId) ?? {};
    if (!(field in st)) {
      if (field === 'currentStatus') st.currentStatus = from ?? '';
      else st.currentLocationId = from;
    }
    out.set(f.entityId, st);
  }
  return out;
}

/** Applies point-in-time state to character rows. */
export function withStateAt<T extends { id: string; currentStatus: string; currentLocationId: string | null }>(rows: T[], state: Map<string, StateAt>): T[] {
  return rows.map((r) => {
    const st = state.get(r.id);
    return st ? { ...r, ...('currentStatus' in st ? { currentStatus: st.currentStatus! } : {}), ...('currentLocationId' in st ? { currentLocationId: st.currentLocationId ?? null } : {}) } : r;
  });
}
