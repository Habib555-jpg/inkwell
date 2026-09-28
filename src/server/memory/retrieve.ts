import { and, desc, eq, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import * as s from '../db/schema';
import type { AppContext } from '../context';
import type { Chapter } from '../services/access';
import { requirementsOf } from '../services/chapters';
import type { ContextPack, RetrievedChunk } from './types';
import { buildNameRegex, tokenOverlap } from '../text/tokenize';
import { estimateTokens } from '../ai/usage';
import { fitToBudget, type BudgetItem } from './budget';
import { characterCard } from './cards';
import { embedWithCache } from './embed';

const TAIL_WORDS = 600;
const tail = (t: string) => t.trim().split(/\s+/).slice(-TAIL_WORDS).join(' ');

export async function searchCanon(ctx: AppContext, novelId: string, query: string, o: { beforeChapter: number; excludeChapter?: number; limit: number; boostNames?: string[] }): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  const { vectors: [q] } = await embedWithCache(ctx.db, ctx.embedder, [query]);
  const lit = s.toVectorLiteral(q);
  const conds = [eq(s.memoryChunks.novelId, novelId), eq(s.memoryChunks.embeddingModel, ctx.embedder.model), lt(s.memoryChunks.chapterNumber, o.beforeChapter), isNotNull(s.memoryChunks.embedding)];
  if (o.excludeChapter !== undefined) conds.push(ne(s.memoryChunks.chapterNumber, o.excludeChapter));
  const rows = await ctx.db.select({
    id: s.memoryChunks.id, chapterNumber: s.memoryChunks.chapterNumber, content: s.memoryChunks.content,
    sim: sql<number>`1 - (${s.memoryChunks.embedding} <=> ${lit}::vector)`,
  }).from(s.memoryChunks).where(and(...conds)).orderBy(sql`${s.memoryChunks.embedding} <=> ${lit}::vector`).limit(o.limit * 4);
  const nameRe = buildNameRegex(o.boostNames ?? []);
  const scored = rows.map((r) => ({
    chunkId: r.id, chapterNumber: r.chapterNumber, content: r.content,
    score: Number(r.sim) + 0.15 * tokenOverlap(query, r.content) + (nameRe && new RegExp(nameRe.source, 'u').test(r.content) ? 0.1 : 0),
  })).sort((a, b) => b.score - a.score);
  const perChapter = new Map<number, number>(); const out: RetrievedChunk[] = [];
  for (const r of scored) {
    const n = perChapter.get(r.chapterNumber) ?? 0;
    if (n >= 2) continue;
    perChapter.set(r.chapterNumber, n + 1); out.push(r);
    if (out.length >= o.limit) break;
  }
  return out;
}

export async function buildContextPack(ctx: AppContext, chapter: Chapter): Promise<ContextPack> {
  const { db } = ctx;
  const N = chapter.number;
  const req = requirementsOf(chapter);
  const [novel] = await db.select().from(s.novels).where(eq(s.novels.id, chapter.novelId));
  const [settings] = await db.select().from(s.novelSettings).where(eq(s.novelSettings.novelId, chapter.novelId));
  const reqText = [req.mainIdea, ...req.requiredEvents, ...req.dialoguePoints, req.instructions, req.restrictions].join('\n');

  // characters
  const allChars = await db.select().from(s.characters).where(eq(s.characters.novelId, novel.id));
  const nameById = new Map(allChars.map((c) => [c.id, c.name]));
  const mentioned = allChars.filter((c) => { const re = buildNameRegex([c.name, ...c.aliases]); return re ? new RegExp(re.source, 'u').test(reqText) : false; });
  const involvedIds = [...new Set([...req.characterIds, ...mentioned.map((c) => c.id)])];
  const involved = allChars.filter((c) => involvedIds.includes(c.id));
  const profiles = involvedIds.length ? await db.select().from(s.characterVoiceProfiles).where(inArray(s.characterVoiceProfiles.characterId, involvedIds)) : [];
  const locIds = involved.map((c) => c.currentLocationId).filter(Boolean) as string[];
  const locs = locIds.length ? await db.select().from(s.locations).where(inArray(s.locations.id, locIds)) : [];

  // timeline
  const events = await db.select().from(s.timelineEvents).where(and(eq(s.timelineEvents.novelId, novel.id), lt(s.timelineEvents.chapterNumber, N)))
    .orderBy(desc(s.timelineEvents.chapterNumber), desc(s.timelineEvents.orderInChapter));
  const recentFor = (id: string) => events.filter((e) => e.characterIds.includes(id)).slice(0, 3).map((e) => `Ch ${e.chapterNumber}: ${e.description}`);
  const timelineSel = [...new Map([...events.slice(0, 5), ...involvedIds.flatMap((id) => events.filter((e) => e.characterIds.includes(id)).slice(0, 3))].map((e) => [e.id, e])).values()]
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.orderInChapter - b.orderInChapter);

  // relationships
  const rels = involvedIds.length ? await db.select().from(s.characterRelationships).where(and(
    eq(s.characterRelationships.novelId, novel.id), eq(s.characterRelationships.active, true),
    or(inArray(s.characterRelationships.fromCharacterId, involvedIds), inArray(s.characterRelationships.toCharacterId, involvedIds)))) : [];

  // recent canon chapters
  const prev = await db.select({ c: s.chapters, v: s.chapterVersions }).from(s.chapters)
    .innerJoin(s.chapterVersions, eq(s.chapterVersions.id, s.chapters.approvedVersionId))
    .where(and(eq(s.chapters.novelId, novel.id), lt(s.chapters.number, N))).orderBy(desc(s.chapters.number)).limit(2);
  const sums = prev.length ? await db.select().from(s.chapterSummaries).where(inArray(s.chapterSummaries.chapterVersionId, prev.map((p) => p.v.id))) : [];
  const recentChapters = prev.map((p, i) => ({
    number: p.c.number, title: p.c.title, summary: sums.find((x) => x.chapterVersionId === p.v.id)?.summary ?? '',
    tail: i === 0 ? tail(p.v.content) : null,
  }));

  // semantic
  const retrieved = await searchCanon(ctx, novel.id, reqText, {
    beforeChapter: N, excludeChapter: prev[0]?.c.number, limit: settings.retrievalTopK, boostNames: involved.flatMap((c) => [c.name, ...c.aliases]),
  });

  // world
  const [wl, wf, wr, wo] = await Promise.all([s.locations, s.factions, s.worldRules, s.storyObjects].map((t) =>
    db.select().from(t as typeof s.locations).where(eq((t as typeof s.locations).novelId, novel.id))));
  const haystack = reqText + '\n' + retrieved.map((r) => r.content).join('\n');
  const named = (name: string) => { const re = buildNameRegex([name]); return re ? new RegExp(re.source, 'u').test(haystack) : false; };
  type W = ContextPack['world'][number] & { id: string; priority: number };
  const world: W[] = [];
  const push = (kind: W['kind'], rows: { id: string; name: string; description: string; category?: string }[]) => {
    for (const r of rows) {
      const isNamed = named(r.name), isLoc = locIds.includes(r.id);
      const bg = kind === 'world_rule' && ['magic', 'rule'].includes(r.category ?? '');
      if (isNamed || isLoc || bg) world.push({ kind, id: r.id, name: r.name, description: r.description, category: r.category, priority: isNamed ? (reqText.includes(r.name) ? 5 : 4) : isLoc ? 4 : 2 });
    }
  };
  push('location', wl); push('faction', wf); push('world_rule', wr as never); push('story_object', wo);

  // preferences
  const prefs = await db.select().from(s.writingPreferences).where(and(eq(s.writingPreferences.novelId, novel.id), eq(s.writingPreferences.status, 'active')));
  const prefSel = prefs.filter((p) => p.scope !== 'character' || (p.characterId && involvedIds.includes(p.characterId)));

  // assemble + budget
  const cards = involved.map((c) => characterCard(c, profiles.find((p) => p.characterId === c.id) ?? null, locs.find((l) => l.id === c.currentLocationId)?.name ?? null, recentFor(c.id), nameById));
  const T = (x: unknown) => estimateTokens(JSON.stringify(x));
  const profile = {
    id: novel.id, title: novel.title, genre: novel.genre, premise: novel.premise, setting: novel.setting, writingStyle: novel.writingStyle,
    tone: novel.tone, rulesText: novel.rulesText, pov: settings.pov, tense: settings.tense, dialogueBalance: settings.dialogueBalance,
    targetWords: req.targetWords ?? novel.targetChapterWords,
  };
  const items: BudgetItem[] = [
    { key: 'profile', tokens: T(profile), priority: 0, required: true },
    { key: 'requirements', tokens: T(req), priority: 0, required: true },
    ...cards.flatMap((c) => [
      { key: `voice:${c.id}`, tokens: T(c.voice), priority: 9 },
      { key: `character:${c.id}`, tokens: T({ ...c, voice: undefined }), priority: 8 },
    ]),
    ...prefSel.map((p) => ({ key: `preference:${p.id}`, tokens: T(p.statement), priority: 8 })),
    ...recentChapters.map((r, i) => ({ key: `recent:${r.number}`, tokens: T(r), priority: i === 0 ? 7 : 6 })),
    ...rels.map((r) => ({ key: `relationship:${r.id}`, tokens: T(r.type + r.description) + 8, priority: 6 })),
    ...timelineSel.map((e) => ({ key: `timeline:${e.id}`, tokens: T(e.description) + 4, priority: 6 })),
    ...retrieved.map((r) => ({ key: `chunk:${r.chunkId}`, tokens: T(r.content), priority: 4 + r.score })),
    ...world.map((w) => ({ key: `world:${w.id}`, tokens: T(w.name + w.description), priority: w.priority })),
  ];
  const fit = fitToBudget(items, settings.contextTokenBudget);
  const k = (key: string) => fit.keep.has(key);
  const pack: ContextPack = {
    novel: profile,
    chapter: { id: chapter.id, number: N, title: chapter.title, ...req },
    characters: cards.map((c) => {
      const base = k(`character:${c.id}`) ? c : { ...c, personality: '', goals: '', fears: '', motivations: '', abilities: '', weaknesses: '', developmentNotes: '', recentEvents: [] };
      return k(`voice:${c.id}`) ? base : { ...base, voice: { ...base.voice, sampleLines: [], relationshipRegisters: [] } };
    }),
    relationships: rels.filter((r) => k(`relationship:${r.id}`)).map((r) => ({ fromName: nameById.get(r.fromCharacterId)!, toName: nameById.get(r.toCharacterId)!, type: r.type, description: r.description, isSecret: r.isSecret })),
    timeline: timelineSel.filter((e) => k(`timeline:${e.id}`)).map((e) => ({ chapterNumber: e.chapterNumber, description: e.description })),
    recentChapters: recentChapters.filter((r) => k(`recent:${r.number}`)),
    retrieved: retrieved.filter((r) => k(`chunk:${r.chunkId}`)),
    world: world.filter((w) => k(`world:${w.id}`)).map(({ id: _i, priority: _p, ...w }) => w),
    preferences: prefSel.filter((p) => k(`preference:${p.id}`)).map((p) => ({ scope: p.scope, statement: p.statement, characterName: p.characterId ? nameById.get(p.characterId) : undefined })),
    budget: { limit: settings.contextTokenBudget, used: fit.used, trimmed: fit.trimmed },
    included: [...fit.keep].map((key) => { const [section, ...rest] = key.split(':'); return { section, id: rest.join(':') || section }; }),
  };
  return pack;
}
