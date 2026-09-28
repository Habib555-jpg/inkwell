import { randomUUID } from 'node:crypto';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { createNovel } from '@/server/services/novels';
import { eq } from 'drizzle-orm';
import type { AppContext } from '@/server/context';
import { createChapter } from '@/server/services/chapters';
import { insertVersion } from '@/server/services/versions';
import { createCharacter } from '@/server/services/characters';
import { createRelationship } from '@/server/services/relationships';
import { createWorldEntity } from '@/server/services/world';
import { indexCanonVersion } from '@/server/memory/index-canon';
import { contentHash } from '@/server/memory/hash';

export async function makeUser(db: DB, email = `u-${randomUUID()}@test.io`) {
  const [u] = await db.insert(s.users).values({ email, passwordHash: 'x' }).returning();
  return u;
}
export async function makeNovel(db: DB, userId: string, overrides: Partial<Parameters<typeof createNovel>[2]> = {}) {
  return createNovel(db, userId, { title: 'The Ashen Crown', genre: 'Fantasy', premise: 'A thief inherits a cursed crown.', ...overrides });
}

/** Test-only shortcut: marks a chapter's version canon + summary + index WITHOUT the approval pipeline (Task 19 tests the real path). */
export async function seedCanonChapter(ctx: AppContext, userId: string, novelId: string, p: { number: number; title?: string; content: string }) {
  const chapter = await createChapter(ctx.db, userId, novelId, { number: p.number, title: p.title ?? `Chapter ${p.number}`, mainIdea: 'seed' });
  const version = await insertVersion(ctx.db, { chapter, content: p.content, source: 'manual' });
  await ctx.db.update(s.chapterVersions).set({ isCanon: true }).where(eq(s.chapterVersions.id, version.id));
  await ctx.db.update(s.chapters).set({ approvedVersionId: version.id, status: 'approved' }).where(eq(s.chapters.id, chapter.id));
  const summary = (await ctx.ai.summarize(p.content, { maxWords: 80 })).value;
  await ctx.db.insert(s.chapterSummaries).values({ chapterVersionId: version.id, novelId, summary, contentHash: contentHash(p.content) });
  await indexCanonVersion(ctx, { novelId, chapterId: chapter.id, chapterNumber: p.number, versionId: version.id, content: p.content });
  return { chapter, version };
}

const PLACES = ['the Ember Market', 'the Salt Road', 'the Duskwood', 'Harrow Keep', 'the Glass Library', 'the Old Quarry', 'Vey Harbor', 'the Iron Steps'];
const DOINGS = ['bargained for bread and rumors', 'argued about the harvest tithe', 'repaired a broken wagon wheel', 'waited out a storm',
  'traded stories with a tinker', 'mapped the northern trail', 'counted coins twice', 'buried an old horse'];
export function fillerChapterText(i: number): string {
  const place = PLACES[i % PLACES.length], doing = DOINGS[(i * 3) % DOINGS.length];
  return [
    `Cass Orrin spent the morning at ${place}, where the merchants ${doing}.`,
    `“Keep your head down,” Cass said. “Nobody here owes us anything.”`,
    `By evening the wind had turned cold and the lanterns guttered along ${place}. Cass wrote a short letter home and did not send it.`,
    `Rumors of the tithe collectors moved faster than the carts. Day ${i} ended quietly.`,
  ].join('\n\n');
}

export async function setupAshenCrown(ctx: AppContext, userId: string) {
  const novel = await makeNovel(ctx.db, userId, { title: 'The Ashen Crown', writingStyle: 'Close third person, wry', tone: 'tense, wry' });
  const mira = await createCharacter(ctx.db, userId, novel.id, { name: 'Mira Vale', aliases: ['Mira'], personality: 'wry, guarded thief', speechStyle: 'short, sarcastic, contractions' });
  const bram = await createCharacter(ctx.db, userId, novel.id, { name: 'Bram Holt', aliases: ['Bram'], personality: 'formal former knight', speechStyle: 'formal, no contractions' });
  const cass = await createCharacter(ctx.db, userId, novel.id, { name: 'Cass Orrin', aliases: ['Cass'], personality: 'pragmatic courier' });
  await createRelationship(ctx.db, userId, novel.id, { fromCharacterId: mira.id, toCharacterId: bram.id, type: 'distrusts' });
  await createRelationship(ctx.db, userId, novel.id, { fromCharacterId: cass.id, toCharacterId: bram.id, type: 'owes a debt to' });
  await createWorldEntity(ctx.db, userId, novel.id, 'world_rule', { name: 'Ash Oath', category: 'magic', description: 'An oath sworn over ash binds the swearer until death.' });
  await createWorldEntity(ctx.db, userId, novel.id, 'location', { name: "Gull's Rest", description: 'A fishing village with an old lighthouse.' });
  return { novel, mira, bram, cass };
}
export const CH2_KEY_TEXT = [
  'Mira reached Gull’s Rest after midnight, soaked and furious.',
  'She climbed the cliff path to the old lighthouse and pried up the third flagstone. Mira hid the Starlight Key beneath the old lighthouse at Gull’s Rest, then pressed the stone back into place.',
  '“Nobody finds it but me,” Mira said. “Not even you, Bram.”',
].join('\n\n');
