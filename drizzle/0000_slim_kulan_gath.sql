CREATE TYPE "public"."assistant_mode" AS ENUM('generate', 'revise', 'continuity', 'brainstorm', 'character', 'story_memory', 'critic');--> statement-breakpoint
CREATE TYPE "public"."chapter_status" AS ENUM('planning', 'drafting', 'approved', 'canon_changed');--> statement-breakpoint
CREATE TYPE "public"."conflict_kind" AS ENUM('field', 'relationship', 'retracted_record');--> statement-breakpoint
CREATE TYPE "public"."conflict_status" AS ENUM('open', 'kept_existing', 'accepted_new', 'merged');--> statement-breakpoint
CREATE TYPE "public"."dialogue_balance" AS ENUM('dialogue_heavy', 'balanced', 'narration_heavy');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('none', 'pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feedback_scope" AS ENUM('chapter', 'character', 'story', 'global');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."origin" AS ENUM('user', 'extracted');--> statement-breakpoint
CREATE TYPE "public"."preference_scope" AS ENUM('global', 'story', 'character');--> statement-breakpoint
CREATE TYPE "public"."preference_status" AS ENUM('candidate', 'active', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."proposal_source" AS ENUM('feedback', 'critic');--> statement-breakpoint
CREATE TYPE "public"."version_source" AS ENUM('generated', 'revised', 'manual', 'restored');--> statement-breakpoint
CREATE TYPE "public"."world_rule_category" AS ENUM('magic', 'technology', 'history', 'rule', 'term', 'other');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid,
	"mode" "assistant_mode" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid,
	"operation" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_version_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"chapter_version_id" uuid NOT NULL,
	"rating" real NOT NULL,
	"what_worked" text DEFAULT '' NOT NULL,
	"what_didnt" text DEFAULT '' NOT NULL,
	"changes_requested" text DEFAULT '' NOT NULL,
	"characters_ok" text DEFAULT '' NOT NULL,
	"dialogue_natural" text DEFAULT '' NOT NULL,
	"followed_instructions" text DEFAULT '' NOT NULL,
	"remove" text DEFAULT '' NOT NULL,
	"add" text DEFAULT '' NOT NULL,
	"approved_after" boolean DEFAULT false NOT NULL,
	"revision_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_range" CHECK ("chapter_feedback"."rating" >= 0 AND "chapter_feedback"."rating" <= 10)
);
--> statement-breakpoint
CREATE TABLE "chapter_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_version_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_events" text[] DEFAULT '{}'::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"source" "version_source" NOT NULL,
	"parent_version_id" uuid,
	"generation_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"continuity_report" jsonb,
	"critic_report" jsonb,
	"is_canon" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"status" "chapter_status" DEFAULT 'planning' NOT NULL,
	"current_version_id" uuid,
	"approved_version_id" uuid,
	"extraction_status" "extraction_status" DEFAULT 'none' NOT NULL,
	"extraction_error" text,
	"main_idea" text DEFAULT '' NOT NULL,
	"required_events" text[] DEFAULT '{}'::text[] NOT NULL,
	"forbidden_events" text[] DEFAULT '{}'::text[] NOT NULL,
	"character_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"dialogue_points" text[] DEFAULT '{}'::text[] NOT NULL,
	"restrictions" text DEFAULT '' NOT NULL,
	"target_words" integer,
	"instructions" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"from_character_id" uuid NOT NULL,
	"to_character_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"since_chapter_number" integer,
	"active" boolean DEFAULT true NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_voice_profiles" (
	"character_id" uuid PRIMARY KEY NOT NULL,
	"novel_id" uuid NOT NULL,
	"user_voice_notes" text DEFAULT '' NOT NULL,
	"register" text DEFAULT '' NOT NULL,
	"sentence_length" text DEFAULT '' NOT NULL,
	"emotional_baseline" text DEFAULT '' NOT NULL,
	"verbal_tics" text[] DEFAULT '{}'::text[] NOT NULL,
	"avoid" text[] DEFAULT '{}'::text[] NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lexical_signature" text[] DEFAULT '{}'::text[] NOT NULL,
	"signature_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
	"sample_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned_samples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relationship_registers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locked_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"age" text DEFAULT '' NOT NULL,
	"appearance" text DEFAULT '' NOT NULL,
	"personality" text DEFAULT '' NOT NULL,
	"goals" text DEFAULT '' NOT NULL,
	"fears" text DEFAULT '' NOT NULL,
	"motivations" text DEFAULT '' NOT NULL,
	"abilities" text DEFAULT '' NOT NULL,
	"weaknesses" text DEFAULT '' NOT NULL,
	"speech_style" text DEFAULT '' NOT NULL,
	"vocabulary" text DEFAULT '' NOT NULL,
	"development_notes" text DEFAULT '' NOT NULL,
	"current_status" text DEFAULT '' NOT NULL,
	"current_location_id" uuid,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dialogue_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_version_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"addressee_id" uuid,
	"chapter_number" integer NOT NULL,
	"line" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_cache" (
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"embedding" vector NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_cache_content_hash_model_pk" PRIMARY KEY("content_hash","model")
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"theme_key" text NOT NULL,
	"scope" "feedback_scope" NOT NULL,
	"character_id" uuid,
	"statement" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"chapter_version_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector,
	"embedding_model" text NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_version_id" uuid,
	"chapter_number" integer,
	"kind" "conflict_kind" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"field" text NOT NULL,
	"existing_value" text DEFAULT '' NOT NULL,
	"proposed_value" text DEFAULT '' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"status" "conflict_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novel_settings" (
	"novel_id" uuid PRIMARY KEY NOT NULL,
	"dialogue_balance" "dialogue_balance" DEFAULT 'balanced' NOT NULL,
	"pov" text DEFAULT 'third_limited' NOT NULL,
	"tense" text DEFAULT 'past' NOT NULL,
	"ai_model" text,
	"retrieval_top_k" integer DEFAULT 8 NOT NULL,
	"context_token_budget" integer DEFAULT 6000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"genre" text DEFAULT '' NOT NULL,
	"premise" text DEFAULT '' NOT NULL,
	"setting" text DEFAULT '' NOT NULL,
	"writing_style" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"target_chapter_words" integer DEFAULT 2500 NOT NULL,
	"rules_text" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"base_version_id" uuid NOT NULL,
	"feedback_id" uuid,
	"source" "proposal_source" NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resulting_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"order_in_chapter" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"character_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"location_id" uuid,
	"importance" integer DEFAULT 2 NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_note_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"feedback_id" uuid,
	"note" text NOT NULL,
	"status" "note_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "world_rule_category" DEFAULT 'rule' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"origin" "origin" DEFAULT 'user' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source_chapter_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "writing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"scope" "preference_scope" NOT NULL,
	"character_id" uuid,
	"theme_key" text,
	"statement" text NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"chapters_seen" integer DEFAULT 0 NOT NULL,
	"status" "preference_status" DEFAULT 'candidate' NOT NULL,
	"status_set_by_user" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"origin" "origin" DEFAULT 'extracted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_facts" ADD CONSTRAINT "chapter_facts_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_facts" ADD CONSTRAINT "chapter_facts_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_feedback" ADD CONSTRAINT "chapter_feedback_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_feedback" ADD CONSTRAINT "chapter_feedback_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_feedback" ADD CONSTRAINT "chapter_feedback_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_feedback" ADD CONSTRAINT "chapter_feedback_revision_version_id_chapter_versions_id_fk" FOREIGN KEY ("revision_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_summaries" ADD CONSTRAINT "chapter_summaries_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_parent_version_id_chapter_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_current_version_id_chapter_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_approved_version_id_chapter_versions_id_fk" FOREIGN KEY ("approved_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_from_character_id_characters_id_fk" FOREIGN KEY ("from_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_to_character_id_characters_id_fk" FOREIGN KEY ("to_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_voice_profiles" ADD CONSTRAINT "character_voice_profiles_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_voice_profiles" ADD CONSTRAINT "character_voice_profiles_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_current_location_id_locations_id_fk" FOREIGN KEY ("current_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_lines" ADD CONSTRAINT "dialogue_lines_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_lines" ADD CONSTRAINT "dialogue_lines_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_lines" ADD CONSTRAINT "dialogue_lines_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_lines" ADD CONSTRAINT "dialogue_lines_addressee_id_characters_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_feedback_id_chapter_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."chapter_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novel_settings" ADD CONSTRAINT "novel_settings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels" ADD CONSTRAINT "novels_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_proposals" ADD CONSTRAINT "revision_proposals_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_proposals" ADD CONSTRAINT "revision_proposals_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_proposals" ADD CONSTRAINT "revision_proposals_base_version_id_chapter_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_proposals" ADD CONSTRAINT "revision_proposals_feedback_id_chapter_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."chapter_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_proposals" ADD CONSTRAINT "revision_proposals_resulting_version_id_chapter_versions_id_fk" FOREIGN KEY ("resulting_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_objects" ADD CONSTRAINT "story_objects_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_objects" ADD CONSTRAINT "story_objects_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_note_candidates" ADD CONSTRAINT "voice_note_candidates_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_note_candidates" ADD CONSTRAINT "voice_note_candidates_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_note_candidates" ADD CONSTRAINT "voice_note_candidates_feedback_id_chapter_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."chapter_feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_rules" ADD CONSTRAINT "world_rules_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_rules" ADD CONSTRAINT "world_rules_source_chapter_version_id_chapter_versions_id_fk" FOREIGN KEY ("source_chapter_version_id") REFERENCES "public"."chapter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_preferences" ADD CONSTRAINT "writing_preferences_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_preferences" ADD CONSTRAINT "writing_preferences_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conv_novel_idx" ON "ai_conversations" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "msg_conv_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "usage_user_time_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "facts_novel_idx" ON "chapter_facts" USING btree ("novel_id","chapter_number");--> statement-breakpoint
CREATE INDEX "feedback_chapter_idx" ON "chapter_feedback" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "summaries_version_uq" ON "chapter_summaries" USING btree ("chapter_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "versions_chapter_number_uq" ON "chapter_versions" USING btree ("chapter_id","version_number");--> statement-breakpoint
CREATE INDEX "versions_novel_canon_idx" ON "chapter_versions" USING btree ("novel_id","is_canon");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_novel_number_uq" ON "chapters" USING btree ("novel_id","number");--> statement-breakpoint
CREATE INDEX "rel_novel_idx" ON "character_relationships" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "rel_from_idx" ON "character_relationships" USING btree ("from_character_id");--> statement-breakpoint
CREATE INDEX "rel_to_idx" ON "character_relationships" USING btree ("to_character_id");--> statement-breakpoint
CREATE INDEX "characters_novel_idx" ON "characters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "dialogue_character_idx" ON "dialogue_lines" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "dialogue_version_idx" ON "dialogue_lines" USING btree ("chapter_version_id");--> statement-breakpoint
CREATE INDEX "factions_novel_idx" ON "factions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "themes_novel_key_idx" ON "feedback_themes" USING btree ("novel_id","theme_key");--> statement-breakpoint
CREATE INDEX "locations_novel_idx" ON "locations" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chunks_novel_model_idx" ON "memory_chunks" USING btree ("novel_id","embedding_model");--> statement-breakpoint
CREATE INDEX "chunks_version_idx" ON "memory_chunks" USING btree ("chapter_version_id");--> statement-breakpoint
CREATE INDEX "conflicts_novel_status_idx" ON "memory_conflicts" USING btree ("novel_id","status");--> statement-breakpoint
CREATE INDEX "novels_owner_idx" ON "novels" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "proposals_chapter_idx" ON "revision_proposals" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "story_objects_novel_idx" ON "story_objects" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timeline_novel_ch_idx" ON "timeline_events" USING btree ("novel_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "voice_notes_char_idx" ON "voice_note_candidates" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "world_rules_novel_idx" ON "world_rules" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "prefs_novel_idx" ON "writing_preferences" USING btree ("novel_id","status");