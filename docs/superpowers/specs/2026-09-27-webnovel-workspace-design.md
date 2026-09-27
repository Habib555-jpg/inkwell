# Webnovel AI Writing Workspace — Design Spec

Date: 2026-09-27
Status: Approved (conversation), pending written-spec review

## 1. Intent

A private, multi-user web application where a novelist works *with* an AI writing partner on a long-running webnovel. The governing principle: **approved canon is truth**. The AI may generate, revise, criticize, brainstorm and remember — only the user makes something canon.

Success = the full core loop works end-to-end with real persistence and real (local) AI processing:

Create Novel → Define Story → Define Characters → Create Chapter → Requirements → Retrieve Memory → Generate Draft → Read → Rate 0–10 + Feedback → AI Revises → Approve → Canon → Extract Memory → Store → Future chapters use that memory.

### Constraints (stated by user)
- No API keys available now. The app must run with **no key** and **no Docker**.
- AI provider layer fully swappable; Claude/OpenAI enabled later through env vars only.
- No fake buttons, no hard-coded novel data, no localStorage persistence, no keys in frontend.
- Never send the whole novel to the model; retrieval must scale to hundreds of chapters.
- Never silently modify canon.

### Assumptions (mine)
- Web app on Next.js; single deployable. Multi-user with credentials auth.
- Local provider prose is scaffold-quality and labelled as such; everything else it does (retrieval, extraction, conflict detection, continuity rules) is real computation on user data.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| UI | Tailwind CSS v4, shadcn/ui-style components (Radix), lucide icons |
| DB | PostgreSQL via Drizzle ORM. Dev/test: **PGlite** (embedded WASM Postgres) with `vector` extension, persisted to `./.data/pglite`. Prod: `DATABASE_URL` → Postgres + pgvector (node-postgres driver). Same schema + drizzle-kit migrations. |
| Auth | Auth.js v5, Credentials provider, bcryptjs, JWT session |
| Validation | Zod on every server action / route handler |
| Tests | Vitest, in-memory PGlite, local provider |
| Logging | small structured logger (`src/server/log.ts`), JSON in prod |

## 3. Module layout

```
src/
  app/                      Next.js routes (UI + route handlers)
  components/               UI components (ui/, workspace/, memory/, ...)
  server/
    db/                     schema.ts, client.ts (PGlite|pg), migrate.ts
    auth/                   auth config, password hashing, requireUser()
    services/               per-entity data access, always owner-scoped
    ai/
      types.ts              AIProvider, EmbeddingProvider interfaces
      registry.ts           env-driven provider selection
      providers/local/      deterministic offline provider
      providers/ollama.ts   optional local LLM (no key)
      providers/anthropic.ts
      providers/openai.ts
      usage.ts              token accounting → ai_usage
      prompts/              prompt builders per mode
    memory/
      chunker.ts            chapter → chunks
      embed.ts              embed + cache by content hash
      retrieve.ts           builds ContextPack
      budget.ts             token budgeting
    pipeline/
      generate.ts           requirements → context → generate → checks → version
      revise.ts             feedback → proposal → new version
      continuity.ts         rule checks + provider analysis
      critic.ts
    canon/
      approve.ts            approval transaction
      extract.ts            fact extraction → diff → conflicts
      conflicts.ts          resolve conflict flows
      preferences.ts        feedback → preference promotion
  lib/                      shared client-safe utils (diff, format)
tests/                      vitest suites + fixtures (seeded 25-chapter novel)
```

Files stay focused; no file is a grab-bag of unrelated concerns.

## 4. AI provider abstraction

```ts
interface AIProvider {
  id: string; model: string;
  generateText(req: GenerateRequest): Promise<AIResult<string>>;
  analyzeText<T>(req: AnalyzeRequest<T>): Promise<AIResult<T>>;   // structured JSON via zod schema
  summarize(text: string, opts): Promise<AIResult<string>>;
  extractMemory(input: ExtractionInput): Promise<AIResult<ExtractedFacts>>;
}
interface EmbeddingProvider {
  id: string; model: string; dimensions: number;
  embed(texts: string[]): Promise<AIResult<number[][]>>;
}
// AIResult<T> = { value: T; usage: { inputTokens; outputTokens; estimated: boolean } }
```

`retrieveRelevantMemory()` is **not** a provider concern — it lives in `memory/retrieve.ts` and uses the EmbeddingProvider plus SQL, so switching providers does not change retrieval logic.

Registry env vars:
- `AI_PROVIDER` = `local` (default) | `ollama` | `anthropic` | `openai`
- `AI_MODEL`, `AI_MODEL_FAST` (cheap model for summaries/extraction)
- `EMBEDDING_PROVIDER` = `local` (default) | `ollama` | `openai`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`
- A configured-but-keyless provider fails at startup with a clear message; the default config never needs a key.

Per-novel settings may override model choice (from the allowed list).

### Local provider (default)
- **Embeddings:** feature hashing of lowercased word unigrams + bigrams + character-name tokens into 384 dims, sublinear TF weighting, L2-normalized. Deterministic; similar texts → high cosine.
- **Summarize:** extractive — sentence scoring by term salience + entity presence; top sentences in original order.
- **Extract memory:** entity detection = capitalized token sequences not sentence-initial-only, matched against known characters/locations/factions (aliases included); new-entity candidates when unseen; event sentences = sentences with an entity + action verb; relationship cues from a verb lexicon ("trusts", "betrayed", "loves", "hates", "allied with"…); state cues ("died", "was injured", "arrived at <Location>").
- **Continuity (analyze):** rule-based checks (see §8).
- **Generate:** builds a structured draft: scenes derived from required events in order, with involved characters, their speech style notes, retrieved context references, and dialogue points rendered as dialogue lines. Header: `[Local draft — connect an AI provider for full prose]`. Never presented as final prose.
- Usage recorded with `estimated: true`, cost 0.

### Ollama / Anthropic / OpenAI
Thin adapters over HTTP/SDK; structured analysis via JSON-mode prompting + zod parse with one repair retry. Anthropic has no embeddings → must pair with `EMBEDDING_PROVIDER=openai|ollama|local`.

Embedding model changes: each chunk stores `embedding_model`; retrieval only compares vectors of the active model; a "Re-embed novel" action (Memory page) backfills. Vector column is dimensionless `vector` (exact scan filtered by `novel_id` — adequate for thousands of chunks per novel; HNSW per-dimension index can be added in prod).

## 5. Data model

All ids `uuid`. All novel-owned tables carry `novel_id` FK (cascade) + index. Timestamps `created_at`, `updated_at`.

- `users` (email unique, password_hash, name)
- `novels` (owner_id FK users, title, genre, premise, setting, writing_style, tone, target_chapter_words, rules_text, notes)
- `novel_settings` (novel_id PK/FK, dialogue_balance enum `dialogue_heavy|balanced|narration_heavy`, pov, tense, ai_model override, retrieval_top_k, context_token_budget)
- `characters` (name, aliases text[], age, appearance, personality, goals, fears, motivations, abilities, weaknesses, speech_style, vocabulary, development_notes, current_status, current_location_id, origin enum `user|extracted`, source_chapter_version_id nullable)
- `character_relationships` (from_character_id, to_character_id, type, description, is_secret bool, since_chapter_number, origin, source_chapter_version_id, active bool) — history kept by deactivating, not deleting.
- `locations`, `factions`, `world_rules` (category: magic/technology/history/rule/term), `story_objects` — each with name, description, origin, source_chapter_version_id.
- `timeline_events` (chapter_number, order_in_chapter, description, character_ids uuid[], location_id, importance 1–3, origin, source_chapter_version_id)
- `chapters` (number unique per novel, title, status enum `planning|drafting|approved|canon_changed`, current_version_id, approved_version_id, requirements: main_idea, required_events text[], forbidden_events text[], character_ids uuid[], tone, dialogue_points text[], restrictions, target_words, instructions)
- `chapter_versions` (chapter_id, version_number, content, source enum `generated|revised|manual|restored`, parent_version_id, generation_meta jsonb (context pack ids, model, prompt hash), continuity_report jsonb, critic_report jsonb, is_canon bool, deleted_at) — immutable content once a newer version exists or once approved; autosave only mutates the current *manual working* version.
- `chapter_feedback` (chapter_version_id, rating numeric(3,1) 0–10, what_worked, what_didnt, changes_requested, characters_ok, dialogue_natural, followed_instructions, remove, add, scope_tags jsonb, revision_version_id nullable, approved_after bool)
- `revision_proposals` (feedback_id, items jsonb [{id, change, rationale, status accepted|rejected|pending}], resulting_version_id)
- `chapter_summaries` (chapter_version_id unique, summary, key_events text[], keywords text[], content_hash) — cache.
- `memory_chunks` (novel_id, chapter_id, chapter_version_id, chapter_number, chunk_index, content, content_hash, embedding vector, embedding_model, keywords text[]) — only for canon versions.
- `memory_conflicts` (novel_id, chapter_version_id, entity_type, entity_id, field, existing_value, proposed_value, evidence, status `open|kept_existing|accepted_new|merged`, resolved_at)
- `writing_preferences` (novel_id, scope enum `global|character|story`, character_id nullable, statement, evidence_count, chapters_seen int, status `candidate|active|dismissed`, pinned bool, origin)
- `feedback_themes` (feedback_id, theme_key, scope, polarity) — raw signals for promotion.
- `ai_conversations` (novel_id, chapter_id nullable, mode), `ai_messages` (conversation_id, role, content)
- `ai_usage` (user_id, novel_id, operation, provider, model, input_tokens, output_tokens, estimated bool, created_at)
- `rate_limits` (key, window_start, count) — DB-backed limiter usable in serverless.

## 6. Memory layers & retrieval

| Layer | Source |
|---|---|
| L1 Novel profile | `novels` + `novel_settings` |
| L2 Story bible | characters, relationships, locations, factions, world_rules, objects |
| L3 Canon timeline | `timeline_events` |
| L4 Approved chapters | `chapter_versions` where is_canon |
| L5 Semantic memory | `memory_chunks` (pgvector) |
| L6 Preferences | `writing_preferences` status=active |
| L7 Current chapter | chapter requirements + current draft |

`buildContextPack(novelId, chapterId)`:
1. **Always:** L1 compact profile; L7 requirements; active L6 preferences.
2. **Characters:** those in `character_ids` + any named in requirements text (alias match) → full cards incl. speech style; relationships among them (active); their last 3 timeline events.
3. **Recency:** summaries of the previous 2 canon chapters + last ~600 words of the immediately previous canon chapter (scene continuity).
4. **Semantic:** query = main idea + required events + dialogue points; embed; cosine top-k (default 8) over canon chunks with `chapter_number < N`, score boosted by keyword overlap and involved-character mention; dedupe per chapter (max 2 chunks/chapter).
5. **World:** world_rules/locations/factions/objects whose names or keywords match requirements or retrieved chunks.
6. **Feedback signals:** chapter-specific notes are *not* carried forward; character-scoped signals for involved characters are.
7. **Budget:** each section has a token allowance within `context_token_budget` (default 6000); lowest-scored items trimmed first; pack records which ids were included (stored in `generation_meta` and shown in the "Memory used" panel).

Prompt size is O(budget), not O(chapters).

## 7. Canon system

**Approval transaction** (`canon/approve.ts`), single DB transaction for state changes:
1. Validate: version belongs to chapter; chapter owned by user; no open blocking conflicts from a previous approval of this chapter.
2. Mark version `is_canon=true`; set `chapters.approved_version_id`, status `approved`; any previous canon version of this chapter → `is_canon=false`.
3. If re-approval (canon changed): retract derived memory — delete memory_chunks and summary for old version; timeline_events/relationships/entities with `origin=extracted` and `source_chapter_version_id=old` are deleted if untouched by the user, or flagged as conflicts if the user edited them.
4. Summarize (cached by content hash).
5. Extract facts → diff vs. current memory:
   - new entity (no name/alias match) → insert with `origin=extracted`.
   - new timeline event → insert.
   - new relationship pair/type → insert.
   - value for an existing field that differs from a non-empty existing value (e.g. character current_status, location, relationship type) → **`memory_conflicts` row**, not overwrite.
   - existing empty field → fill.
6. Chunk (~350 words, 50 overlap, paragraph-aware) → embed (cache by content_hash+model) → insert memory_chunks.
7. Return approval report: counts added, conflicts opened.

Extraction/embedding happen inside the request but after the state-change commit is prepared; if AI extraction fails, approval still commits the canon text and records a `pending_extraction` flag the user can retry (canon text is never lost due to AI failure).

**Editing approved chapters:** the editor on an approved chapter creates a new *manual* version; chapter status → `canon_changed`; UI banner "Canon differs from approved version — re-approve to update memory". Memory keeps reflecting the approved version until re-approval.

**Drafts never become canon implicitly.** Brainstorm/character/critic outputs are stored as assistant messages only; "Save to bible" actions are explicit user clicks creating `origin=user` records.

**Conflict resolution UI:** keep existing / accept new / edit merged value. Accepting new updates the entity and records source.

## 8. Continuity checking

Runs after generation/revision and on demand. Output `ContinuityReport { issues: [{severity, category, message, evidence: {chapterNumber, quote}}] }`.

Rule checks (all providers):
- Required events: each required event must have ≥ threshold token overlap with some paragraph → else `missing_required_event`.
- Forbidden events: overlap above threshold → `forbidden_event_present`.
- Character presence: characters mentioned in draft but deceased (current_status contains dead/died) → `dead_character_acts`.
- Location: character's last known location vs. draft's first mention context (flag as `location_jump` if different and no travel verb).
- Knowledge/fact contradiction: negation pattern check — draft sentences "X has never/didn't/doesn't …" whose semantic neighbor in canon (top chunk, cosine > 0.75) asserts the positive → `canon_contradiction` with both quotes.
- Unknown names: capitalized names not in bible → info-level `new_entity`.

Provider analysis (LLM providers): structured contradiction review over the context pack; merged with rule results. Local provider uses rules only.

Issues never auto-modify canon; the user chooses "draft is wrong" (feeds revision) or "canon is wrong" (opens a memory edit).

## 9. Feedback, revision, preferences

- Evaluation form after reading a draft: rating slider 0–10 (0.5 steps) + the eight questions from the brief + optional approve checkbox.
- `analyzeFeedback` → revision proposal items (each a concrete change with rationale) + scope tags per statement (`chapter|character:<id>|story|global`) + theme keys (e.g. `dialogue.too_formal`, `description.too_long`, `more_internal_monologue`, `pacing.too_fast`).
- User accepts/rejects items → "Apply" creates a new `revised` version (parent = rated version), feedback row links `revision_version_id`.
- Preference promotion: a theme with `global`/`story` scope becomes an active preference when seen in ≥3 feedback entries across ≥2 distinct chapters; `character` scope themes attach to that character. Chapter-scoped themes never promote. Low ratings alone never create preferences. Candidates visible on Memory page; user can activate/dismiss/pin/edit.
- Ratings history chart per novel (rating per version, final approved rating per chapter).

## 10. Versioning

- Every generate/regenerate/revise/restore creates a new version (monotonic `version_number`).
- Manual editing: autosave (debounced 1.5 s, plus on blur) writes to the current version *only if* it's source `manual`, not canon, and has no children; otherwise first edit forks a new `manual` version.
- Compare: word-level diff of any two versions side by side.
- Restore: creates a `restored` copy as new current version.
- Delete: soft-delete allowed only for non-canon versions that are not current.
- Approved version: badge + distinct color throughout.

## 11. Assistant modes

GENERATE, REVISE, CONTINUITY, BRAINSTORM, CHARACTER, STORY MEMORY, CRITIC. Each mode has its own prompt builder and uses the ContextPack. STORY MEMORY renders what retrieval would include for the current chapter plus a bible overview. CRITIC returns categorized findings (dialogue, pacing, character inconsistency, repetition — repeated n-grams/sentence openers computed locally, weak scenes, missing required events, unnecessary scenes, continuity risks); critic never returns an empty "looks good" — local critic always computes metrics (dialogue ratio vs. setting, repetition, sentence-length variance, per-character dialogue distinctness by vocabulary overlap).

## 12. UI

Nav: Dashboard, Novels, Novel Workspace, Characters, World, Timeline, Chapters, Memory, Settings.
Workspace: left novel nav + chapter list with status dots; center chapter header (number, title, status badge Draft/Canon/Canon changed), requirements drawer, editor (textarea-based rich-enough editor with serif reading font), action bar (Generate, Regenerate, Improve, Continuity check, Approve); right panel tabs: Assistant (mode select + thread), Memory used, Feedback (rating + questions + proposal review), Continuity, Versions.
Usage indicator in header (tokens this month, estimated flag).
Visual tone: calm, editorial, serious writing tool; light/dark themes.

## 13. Security

- Auth.js JWT sessions; bcrypt (cost 12); password min 8.
- `requireUser()` in every server action/route; all service functions take `userId` and join through `novels.owner_id`; not-found (404) returned for others' resources — no existence leak.
- Zod validation + length caps on all text inputs (chapter content ≤ 200k chars).
- Rate limiting on AI operations (default 30/min/user) and auth endpoints (10/min/IP).
- Keys only in server env; `server-only` import guard on server modules.
- User text rendered as text (React escaping); no `dangerouslySetInnerHTML`.
- Prompt-injection hygiene: user/canon content wrapped in delimited blocks, system instructions separate.

## 14. Cost control

Summary + embedding caches by content hash; retrieval budget; fast model for summaries/extraction; nothing re-summarized unless content hash changes; `ai_usage` table + UI display; model selectable per novel.

## 15. Testing

Vitest suites (in-memory PGlite, local provider):
- auth: register/login/hash; duplicate email.
- authorization & isolation: user B cannot read/update/approve user A's novel, chapter, version, character, memory (service + route level).
- novel/chapter CRUD, versioning (monotonic, non-destructive, restore, delete rules, autosave fork rule).
- approval workflow: canon flags, single canon version, re-approval retraction, extraction failure keeps canon.
- memory extraction: new entities, events, relationships; conflict creation instead of overwrite.
- retrieval: seeded 25-chapter novel; generating ch. 25 retrieves the ch. 2 fact; context pack stays within budget regardless of chapter count.
- canon protection: drafts/brainstorm never alter bible; conflicts not auto-applied.
- feedback & rating storage, preference promotion thresholds, chapter-scoped non-promotion.
- continuity: missing required, forbidden present, contradiction detection.
- providers: registry selection, keyless default, error on missing key for keyed provider.

## 16. Delivery stages

1. Scaffold core app (Next.js, Tailwind, lint, vitest).
2. Database schema, client, migrations, auth, owner-scoped services, CRUD UI for novel/bible.
3. AI layer: interfaces, registry, local provider, usage tracking; keyed adapters.
4. Memory/RAG: chunking, embeddings, retrieval, ContextPack, generation pipeline.
5. Feedback/revision + versioning UI.
6. Canon system: approval, extraction, conflicts, preferences, memory page.
7. Continuity/critic/assistant modes, polish, README, full test pass, end-to-end verification.

## 17. Out of scope (MVP)

OAuth/social login, collaboration between users, export to EPUB, streaming token output (may add), billing.
