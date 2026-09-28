import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestContext } from '../helpers/db';
import { makeUser, setupAshenCrown, seedCanonChapter, CH2_KEY_TEXT } from '../helpers/fixtures';
import { runAssistant, listConversation } from '@/server/assistant/service';
import { createChapter } from '@/server/services/chapters';
import { NotFoundError } from '@/server/errors';
import type { AppContext } from '@/server/context';

let ctx: AppContext;
beforeAll(async () => { ctx = await createTestContext(); });
const bibleCount = async (novelId: string) => (await ctx.db.execute(sql`select (select count(*) from characters where novel_id=${novelId}) + (select count(*) from timeline_events where novel_id=${novelId}) + (select count(*) from character_relationships where novel_id=${novelId}) + (select count(*) from world_rules where novel_id=${novelId}) as n`) as unknown as { rows: { n: number }[] }).rows[0].n;

describe('assistant modes', () => {
  it('each mode answers, persists the thread, and never edits the bible', async () => {
    const u = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await seedCanonChapter(ctx, u.id, w.novel.id, { number: 2, content: CH2_KEY_TEXT });
    const ch = await createChapter(ctx.db, u.id, w.novel.id, { number: 3, mainIdea: 'Mira goes back for the key', requiredEvents: ['Mira retrieves the Starlight Key'], characterIds: [w.mira.id] });
    const before = await bibleCount(w.novel.id);
    const gen = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'generate', message: 'Draft it' });
    expect(gen.meta.versionId).toBeTruthy();
    const brainstorm = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'brainstorm', message: 'What could go wrong at the lighthouse?', conversationId: gen.conversationId });
    expect(brainstorm.reply.startsWith('Ideas (not canon):')).toBe(true);
    const character = await runAssistant(ctx, u.id, { novelId: w.novel.id, mode: 'character', message: 'Tell me about Bram' });
    expect(character.reply).toContain('Bram Holt');
    const memory = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'story_memory', message: 'What do you remember?' });
    expect(memory.reply).toContain('Chapter 2');
    const critic = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'critic', message: 'Critique' });
    expect(critic.reply.length).toBeGreaterThan(40);
    const cont = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'continuity', message: 'Check' });
    expect(cont.reply.length).toBeGreaterThan(20);
    const rev = await runAssistant(ctx, u.id, { novelId: w.novel.id, chapterId: ch.id, mode: 'revise', message: 'Remove the recap. The dialogue is too formal.' });
    expect(rev.meta.proposalId).toBeTruthy();
    expect(await bibleCount(w.novel.id)).toBe(before);
    const thread = await listConversation(ctx.db, u.id, gen.conversationId);
    expect(thread.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });
  it('isolates users', async () => {
    const u = await makeUser(ctx.db); const o = await makeUser(ctx.db); const w = await setupAshenCrown(ctx, u.id);
    await expect(runAssistant(ctx, o.id, { novelId: w.novel.id, mode: 'story_memory', message: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    const r = await runAssistant(ctx, u.id, { novelId: w.novel.id, mode: 'story_memory', message: 'x' });
    await expect(listConversation(ctx.db, o.id, r.conversationId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
