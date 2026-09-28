import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb, real,
  index, uniqueIndex, customType, check, primaryKey, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { RevisionItem } from '../ai/types';

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => 'vector',
  toDriver: (v) => `[${v.join(',')}]`,
  fromDriver: (v) => JSON.parse(v),
});
export const toVectorLiteral = (v: number[]) => `[${v.join(',')}]`;

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());
const str = (name: string) => text(name).notNull().default('');
const textArray = (name: string) => text(name).array().notNull().default(sql`'{}'::text[]`);
const uuidArray = (name: string) => uuid(name).array().notNull().default(sql`'{}'::uuid[]`);

export const originEnum = pgEnum('origin', ['user', 'extracted']);
export const chapterStatusEnum = pgEnum('chapter_status', ['planning', 'drafting', 'approved', 'canon_changed']);
export const versionSourceEnum = pgEnum('version_source', ['generated', 'revised', 'manual', 'restored']);
export const dialogueBalanceEnum = pgEnum('dialogue_balance', ['dialogue_heavy', 'balanced', 'narration_heavy']);
export const extractionStatusEnum = pgEnum('extraction_status', ['none', 'pending', 'done', 'failed']);
export const conflictStatusEnum = pgEnum('conflict_status', ['open', 'kept_existing', 'accepted_new', 'merged']);
export const conflictKindEnum = pgEnum('conflict_kind', ['field', 'relationship', 'retracted_record']);
export const prefScopeEnum = pgEnum('preference_scope', ['global', 'story', 'character']);
export const prefStatusEnum = pgEnum('preference_status', ['candidate', 'active', 'dismissed']);
export const feedbackScopeEnum = pgEnum('feedback_scope', ['chapter', 'character', 'story', 'global']);
export const worldRuleCategoryEnum = pgEnum('world_rule_category', ['magic', 'technology', 'history', 'rule', 'term', 'other']);
export const assistantModeEnum = pgEnum('assistant_mode', ['generate', 'revise', 'continuity', 'brainstorm', 'character', 'story_memory', 'critic']);
export const noteStatusEnum = pgEnum('note_status', ['pending', 'accepted', 'rejected']);
export const proposalSourceEnum = pgEnum('proposal_source', ['feedback', 'critic']);

// ---------- identity ----------
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  name: str('name'),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('users_email_uq').on(t.email)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256(token) hex
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
});

// ---------- novel ----------
export const novels = pgTable('novels', {
  id: id(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  genre: str('genre'),
  premise: str('premise'),
  setting: str('setting'),
  writingStyle: str('writing_style'),
  tone: str('tone'),
  targetChapterWords: integer('target_chapter_words').notNull().default(2500),
  rulesText: str('rules_text'),
  notes: str('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('novels_owner_idx').on(t.ownerId)]);

export const novelSettings = pgTable('novel_settings', {
  novelId: uuid('novel_id').primaryKey().references(() => novels.id, { onDelete: 'cascade' }),
  dialogueBalance: dialogueBalanceEnum('dialogue_balance').notNull().default('balanced'),
  pov: text('pov').notNull().default('third_limited'),
  tense: text('tense').notNull().default('past'),
  aiModel: text('ai_model'),
  retrievalTopK: integer('retrieval_top_k').notNull().default(8),
  contextTokenBudget: integer('context_token_budget').notNull().default(6000),
  updatedAt: updatedAt(),
});

// shared columns for bible records
const bibleCols = () => ({
  origin: originEnum('origin').notNull().default('user'),
  userEdited: boolean('user_edited').notNull().default(false),
  sourceChapterVersionId: uuid('source_chapter_version_id').references((): AnyPgColumn => chapterVersions.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const locations = pgTable('locations', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: str('description'),
  ...bibleCols(),
}, (t) => [index('locations_novel_idx').on(t.novelId)]);

export const factions = pgTable('factions', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: str('description'),
  ...bibleCols(),
}, (t) => [index('factions_novel_idx').on(t.novelId)]);

export const worldRules = pgTable('world_rules', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: worldRuleCategoryEnum('category').notNull().default('rule'),
  description: str('description'),
  ...bibleCols(),
}, (t) => [index('world_rules_novel_idx').on(t.novelId)]);

export const storyObjects = pgTable('story_objects', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: str('description'),
  ...bibleCols(),
}, (t) => [index('story_objects_novel_idx').on(t.novelId)]);

export const characters = pgTable('characters', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  aliases: textArray('aliases'),
  role: str('role'),
  age: str('age'),
  appearance: str('appearance'),
  personality: str('personality'),
  goals: str('goals'),
  fears: str('fears'),
  motivations: str('motivations'),
  abilities: str('abilities'),
  weaknesses: str('weaknesses'),
  speechStyle: str('speech_style'),
  vocabulary: str('vocabulary'),
  developmentNotes: str('development_notes'),
  currentStatus: str('current_status'),
  currentLocationId: uuid('current_location_id').references(() => locations.id, { onDelete: 'set null' }),
  ...bibleCols(),
}, (t) => [index('characters_novel_idx').on(t.novelId)]);

export const characterRelationships = pgTable('character_relationships', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  fromCharacterId: uuid('from_character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  toCharacterId: uuid('to_character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  description: str('description'),
  isSecret: boolean('is_secret').notNull().default(false),
  sinceChapterNumber: integer('since_chapter_number'),
  active: boolean('active').notNull().default(true),
  ...bibleCols(),
}, (t) => [
  index('rel_novel_idx').on(t.novelId),
  index('rel_from_idx').on(t.fromCharacterId),
  index('rel_to_idx').on(t.toCharacterId),
]);

export const timelineEvents = pgTable('timeline_events', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  orderInChapter: integer('order_in_chapter').notNull().default(0),
  description: text('description').notNull(),
  characterIds: uuidArray('character_ids'),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  importance: integer('importance').notNull().default(2),
  ...bibleCols(),
}, (t) => [index('timeline_novel_ch_idx').on(t.novelId, t.chapterNumber)]);

// ---------- chapters ----------
export const chapters = pgTable('chapters', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: str('title'),
  status: chapterStatusEnum('status').notNull().default('planning'),
  currentVersionId: uuid('current_version_id').references((): AnyPgColumn => chapterVersions.id, { onDelete: 'set null' }),
  approvedVersionId: uuid('approved_version_id').references((): AnyPgColumn => chapterVersions.id, { onDelete: 'set null' }),
  extractionStatus: extractionStatusEnum('extraction_status').notNull().default('none'),
  extractionError: text('extraction_error'),
  mainIdea: str('main_idea'),
  requiredEvents: textArray('required_events'),
  forbiddenEvents: textArray('forbidden_events'),
  characterIds: uuidArray('character_ids'),
  tone: str('tone'),
  dialoguePoints: textArray('dialogue_points'),
  restrictions: str('restrictions'),
  targetWords: integer('target_words'),
  instructions: str('instructions'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('chapters_novel_number_uq').on(t.novelId, t.number)]);

export const chapterVersions = pgTable('chapter_versions', {
  id: id(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  source: versionSourceEnum('source').notNull(),
  parentVersionId: uuid('parent_version_id').references((): AnyPgColumn => chapterVersions.id, { onDelete: 'set null' }),
  generationMeta: jsonb('generation_meta').$type<Record<string, unknown>>().notNull().default({}),
  continuityReport: jsonb('continuity_report').$type<unknown>(),
  criticReport: jsonb('critic_report').$type<unknown>(),
  isCanon: boolean('is_canon').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('versions_chapter_number_uq').on(t.chapterId, t.versionNumber),
  index('versions_novel_canon_idx').on(t.novelId, t.isCanon),
]);

export const chapterSummaries = pgTable('chapter_summaries', {
  id: id(),
  chapterVersionId: uuid('chapter_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  keyEvents: textArray('key_events'),
  keywords: textArray('keywords'),
  contentHash: text('content_hash').notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('summaries_version_uq').on(t.chapterVersionId)]);

export const chapterFacts = pgTable('chapter_facts', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterVersionId: uuid('chapter_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  kind: text('kind').notNull(), // new_character|new_location|new_faction|new_object|world_rule|event|relationship|character_state|revelation
  content: text('content').notNull(),
  entityId: uuid('entity_id'),
  createdAt: createdAt(),
}, (t) => [index('facts_novel_idx').on(t.novelId, t.chapterNumber)]);

// ---------- feedback ----------
export const chapterFeedback = pgTable('chapter_feedback', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  chapterVersionId: uuid('chapter_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  rating: real('rating').notNull(),
  whatWorked: str('what_worked'),
  whatDidnt: str('what_didnt'),
  changesRequested: str('changes_requested'),
  charactersOk: str('characters_ok'),
  dialogueNatural: str('dialogue_natural'),
  followedInstructions: str('followed_instructions'),
  remove: str('remove'),
  add: str('add'),
  approvedAfter: boolean('approved_after').notNull().default(false),
  revisionVersionId: uuid('revision_version_id').references(() => chapterVersions.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  index('feedback_chapter_idx').on(t.chapterId),
  check('rating_range', sql`${t.rating} >= 0 AND ${t.rating} <= 10`),
]);

export const feedbackThemes = pgTable('feedback_themes', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').notNull().references(() => chapterFeedback.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  themeKey: text('theme_key').notNull(),
  scope: feedbackScopeEnum('scope').notNull(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  createdAt: createdAt(),
}, (t) => [index('themes_novel_key_idx').on(t.novelId, t.themeKey)]);

export const revisionProposals = pgTable('revision_proposals', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  baseVersionId: uuid('base_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').references(() => chapterFeedback.id, { onDelete: 'cascade' }),
  source: proposalSourceEnum('source').notNull(),
  items: jsonb('items').$type<RevisionItem[]>().notNull().default([]),
  resultingVersionId: uuid('resulting_version_id').references(() => chapterVersions.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('proposals_chapter_idx').on(t.chapterId)]);

export const writingPreferences = pgTable('writing_preferences', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  scope: prefScopeEnum('scope').notNull(),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'cascade' }),
  themeKey: text('theme_key'),
  statement: text('statement').notNull(),
  evidenceCount: integer('evidence_count').notNull().default(0),
  chaptersSeen: integer('chapters_seen').notNull().default(0),
  status: prefStatusEnum('status').notNull().default('candidate'),
  statusSetByUser: boolean('status_set_by_user').notNull().default(false),
  pinned: boolean('pinned').notNull().default(false),
  origin: originEnum('origin').notNull().default('extracted'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('prefs_novel_idx').on(t.novelId, t.status)]);

// ---------- memory ----------
export const memoryChunks = pgTable('memory_chunks', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  chapterVersionId: uuid('chapter_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  chapterNumber: integer('chapter_number').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  embedding: vector('embedding'),
  embeddingModel: text('embedding_model').notNull(),
  keywords: textArray('keywords'),
  createdAt: createdAt(),
}, (t) => [
  index('chunks_novel_model_idx').on(t.novelId, t.embeddingModel),
  index('chunks_version_idx').on(t.chapterVersionId),
]);

export const embeddingCache = pgTable('embedding_cache', {
  contentHash: text('content_hash').notNull(),
  model: text('model').notNull(),
  embedding: vector('embedding').notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.contentHash, t.model] })]);

export const memoryConflicts = pgTable('memory_conflicts', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterVersionId: uuid('chapter_version_id').references(() => chapterVersions.id, { onDelete: 'set null' }),
  chapterNumber: integer('chapter_number'),
  kind: conflictKindEnum('kind').notNull(),
  entityType: text('entity_type').notNull(), // character|location|faction|world_rule|story_object|relationship|timeline_event
  entityId: uuid('entity_id'),
  field: text('field').notNull(),
  existingValue: str('existing_value'),
  proposedValue: str('proposed_value'),
  evidence: str('evidence'),
  status: conflictStatusEnum('status').notNull().default('open'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('conflicts_novel_status_idx').on(t.novelId, t.status)]);

export const dialogueLines = pgTable('dialogue_lines', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterVersionId: uuid('chapter_version_id').notNull().references(() => chapterVersions.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').references(() => characters.id, { onDelete: 'set null' }),
  chapterNumber: integer('chapter_number').notNull(),
  line: text('line').notNull(),
  createdAt: createdAt(),
}, (t) => [index('dialogue_character_idx').on(t.characterId), index('dialogue_version_idx').on(t.chapterVersionId)]);

export const characterVoiceProfiles = pgTable('character_voice_profiles', {
  characterId: uuid('character_id').primaryKey().references(() => characters.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  userVoiceNotes: str('user_voice_notes'),
  register: str('register'),
  sentenceLength: str('sentence_length'),
  emotionalBaseline: str('emotional_baseline'),
  verbalTics: textArray('verbal_tics'),
  avoid: textArray('avoid'),
  stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}),
  lexicalSignature: textArray('lexical_signature'),
  signaturePhrases: textArray('signature_phrases'),
  sampleLines: jsonb('sample_lines').$type<{ quote: string; chapterNumber: number }[]>().notNull().default([]),
  pinnedSamples: jsonb('pinned_samples').$type<{ quote: string; chapterNumber: number }[]>().notNull().default([]),
  relationshipRegisters: jsonb('relationship_registers').$type<{ toCharacterId: string; note: string }[]>().notNull().default([]),
  lockedFields: textArray('locked_fields'),
  lineCount: integer('line_count').notNull().default(0),
  updatedAt: updatedAt(),
});

export const voiceNoteCandidates = pgTable('voice_note_candidates', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').references(() => chapterFeedback.id, { onDelete: 'set null' }),
  note: text('note').notNull(),
  status: noteStatusEnum('status').notNull().default('pending'),
  createdAt: createdAt(),
}, (t) => [index('voice_notes_char_idx').on(t.characterId)]);

// ---------- assistant & usage ----------
export const aiConversations = pgTable('ai_conversations', {
  id: id(),
  novelId: uuid('novel_id').notNull().references(() => novels.id, { onDelete: 'cascade' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  mode: assistantModeEnum('mode').notNull(),
  title: str('title'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('conv_novel_idx').on(t.novelId)]);

export const aiMessages = pgTable('ai_messages', {
  id: id(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user|assistant
  content: text('content').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index('msg_conv_idx').on(t.conversationId)]);

export const aiUsage = pgTable('ai_usage', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  novelId: uuid('novel_id').references(() => novels.id, { onDelete: 'set null' }),
  operation: text('operation').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  estimated: boolean('estimated').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('usage_user_time_idx').on(t.userId, t.createdAt)]);
