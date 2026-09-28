# Inkwell — an AI writing workspace for webnovels

Inkwell is a private workspace where you write a long-running webnovel **with** an AI writing partner. You describe the novel and its characters. For each chapter you give the main idea, the events that must and must not happen, and the characters involved. Inkwell retrieves what it needs from approved chapters, writes a draft, and asks how well it matches what you wanted (0–10 plus structured feedback). It then proposes concrete revisions you accept or reject. When you approve a chapter, it becomes **canon**, and Inkwell extracts what it learned into a memory you can inspect and correct.

**Approved canon is truth.** The AI can suggest, generate, criticize and remember. Only you make something canon, and memory never overwrites what you established without asking.

## Quick start (no API key, no database server)

```bash
npm install
cp .env.example .env.local      # optional — defaults work as-is
npm run dev                     # http://localhost:3000
npm run db:seed                 # optional: demo account with a 6-chapter novel (prints its password once)
```

The database is embedded Postgres (PGlite + pgvector) stored in `./.data/pglite`, created and migrated automatically on first request. The default AI provider runs fully offline.

> Windows note: this repo lives in a folder whose name contains `&`, which breaks npm's `.bin` shims, so every `npm run` script calls `node` on the package entry point directly. Use the scripts rather than `npx`.

## Architecture

```
Browser (React 19, client components) ──server actions──▶ src/app/**/actions.ts
                                                          │  requireUser + zod + runAction
                                                          ▼
                             src/server/services · pipeline · canon · feedback · voice · memory · assistant
                                                          │  every query scoped by novels.owner_id
                         ┌────────────────────────────────┼─────────────────────────────┐
                         ▼                                ▼                             ▼
             AIProvider / EmbeddingProvider       Drizzle ORM (Postgres)          token usage (ai_usage)
     local · ollama · anthropic · openai         PGlite (dev/test) or pg + pgvector
```

- **Next.js 16** App Router. Pages are server components; mutations are server actions returning `ActionResult<T>`. `src/proxy.ts` redirects signed-out requests.
- **`src/server/`** holds all domain logic. It is framework-free (it takes an explicit `AppContext { db, ai, embedder }`) and is tested directly.
  - `services/`: novels, story bible, chapters, non-destructive versions
  - `ai/`: provider interfaces, adapters, prompts, schemas, usage tracking
  - `memory/`: chunking, cached embeddings, retrieval, token budget
  - `voice/`: character voice profiles
  - `pipeline/`: generation, revision, continuity checks, critic
  - `feedback/`: ratings, scoped feedback analysis, preference promotion
  - `canon/`: approval, extraction, retraction, conflicts, memory editing
  - `assistant/`: the seven assistant modes
- **Auth:** email and password. Passwords are bcrypt-hashed; sessions are random tokens stored hashed in the database and sent as an `httpOnly` cookie.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(unset)* | Real Postgres (needs the `vector` extension). Unset uses embedded PGlite. |
| `PGLITE_DIR` | `./.data/pglite` | Where embedded Postgres stores data. |
| `DB_AUTO_MIGRATE` | `true` | Apply migrations when the server first connects. |
| `AI_PROVIDER` | `local` | `local` · `ollama` · `anthropic` · `openai` |
| `AI_MODEL` / `AI_MODEL_FAST` | provider defaults | Main writing model / cheaper model for summaries, extraction and analysis. |
| `ANTHROPIC_API_KEY` | — | Required when `AI_PROVIDER=anthropic`. |
| `ANTHROPIC_SERVER_FALLBACK` | `default` | `default` enables Anthropic's server-side refusal fallback on models that support it; `off` disables it. |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL` | `local` | `local` · `ollama` · `openai`. Anthropic has no embeddings API. |
| `OPENAI_API_KEY` | — | Required for OpenAI text or embeddings. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama server. |
| `AI_RATE_LIMIT_PER_MIN` | `30` | AI operations per user per minute. |
| `LOG_LEVEL` | `info` | `debug` · `info` · `warn` · `error` |

A keyed provider selected without its key fails at startup with a message naming the missing variable. The default configuration never needs a key. API keys are only read on the server and are never sent to the browser. **Settings → AI provider** shows what is configured, never the values.

## Database setup

- **Development and tests:** nothing to install. Tests boot a fresh in-memory PGlite per test file.
- **Production:**
  1. Point `DATABASE_URL` at Postgres 15+ with pgvector available. Migrations run `CREATE EXTENSION IF NOT EXISTS vector` for you.
  2. Apply migrations with `npm run db:migrate`, or leave `DB_AUTO_MIGRATE=true`.
  3. Back up like any Postgres database.
- **Schema changes:** edit `src/server/db/schema.ts`, then run `npm run db:generate` to write a new SQL migration under `drizzle/`.
- **Switching** from PGlite to Postgres does not copy existing data.

## AI provider setup

| Provider | How | Notes |
|---|---|---|
| **local** (default) | nothing | Offline and free. Retrieval, memory extraction, conflict detection, continuity rules, the critic, voice profiles and feedback analysis all run for real on your data. **Drafts are structured scaffolds** (scenes, beats, voice cues, canon reminders), clearly labelled `[Local draft — …]`. They are not finished prose, and approval refuses an unedited scaffold. |
| **Ollama** | `AI_PROVIDER=ollama`, `EMBEDDING_PROVIDER=ollama`; `ollama pull llama3.1 nomic-embed-text` | Real prose with no key; quality depends on your hardware and model. |
| **Anthropic** | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=…` | Defaults: `claude-opus-5` (writing) and `claude-haiku-4-5` (analysis); change them with `AI_MODEL` / `AI_MODEL_FAST`. Long outputs use streaming. Structured analysis uses native structured outputs (`messages.parse` + `zodOutputFormat`), falling back to validated JSON. `ANTHROPIC_SERVER_FALLBACK=default` enables the server-side refusal fallback on supporting models. Pair with `EMBEDDING_PROVIDER=openai`, `ollama` or `local`. |
| **OpenAI** | `AI_PROVIDER=openai`, `OPENAI_API_KEY=…` | Defaults `gpt-5` / `gpt-5-mini`; embeddings `text-embedding-3-small`. |

Each novel can override the writing model in **Novel settings**. After changing the embedding provider, open **Memory → Semantic memory → Re-index all canon**. Retrieval only compares vectors from the active model, so nothing mixes.

## How the memory system works

Seven layers, assembled per chapter into a token-budgeted **context pack**, never a dump of the whole novel:

1. **Novel profile:** premise, setting, style, tone, rules, POV, dialogue balance.
2. **Story bible:** characters, relationships, locations, factions, world rules, objects.
3. **Canon timeline:** events from approved chapters.
4. **Approved chapters:** full canonical text, one approved version per chapter.
5. **Semantic memory:** approved text split into ~350-word passages, embedded with pgvector.
6. **Writing preferences:** learned from repeated feedback, or written by you.
7. **Current chapter:** the chapter's requirements and draft.

**Retrieval** for chapter *N* includes:
- involved characters, each with a **voice card**
- relationships touching them
- recent timeline events
- summaries of the previous two canon chapters, plus the last ~600 words of the immediately previous one
- the most relevant older canon passages (vector similarity + keyword overlap + character mentions, at most 2 per chapter, only chapters < *N*)
- world entries named in the requirements or the retrieved passages
- active preferences

Everything is ranked and trimmed to `context_token_budget` (default 6000 tokens). Prompt size therefore stays flat whether the novel has 5 chapters or 500. A test proves that a chapter-2 fact is retrieved while writing chapter 25.

**Approval** (`canon/approve.ts`):
1. The version becomes the only canon version of its chapter.
2. Everything derived from the previously approved version is retracted:
   - records it created are removed if you never edited them, or turned into conflicts if you did
   - state changes are reverted
3. Inkwell summarizes the chapter, extracts facts, and applies them under the conflict policy below.
4. It harvests attributed dialogue and recomputes voice profiles.
5. It embeds the chapter's passages.

If an AI step fails, the chapter still becomes canon and shows a **Retry** banner. Editing an approved chapter creates a new version and marks it "Canon changed". Memory keeps reflecting the approved text until you re-approve.

**Conflict policy:** new entities are added and empty fields are filled. A new value is **never** written over an existing one when:
- you authored it
- it would bring a dead character back
- it comes from an older chapter than the latest canon
- it is a description or rule wording
- it changes a relationship

These become conflicts on the Memory page (keep memory / use chapter / write a merged value). Only extracted characters' status and location progress automatically on the latest chapter, and each change records where it came from.

**Voice profiles:**
- **Source:** dialogue from approved chapters only. Each line is attributed through speech tags, or through the only named character in the paragraph.
- **Derived:** register, sentence length, emotional baseline, verbal tics, signature words and phrases, sample lines, and how a character speaks to specific people.
- **Your edits win:** any field you edit is locked and never re-derived ("reset" unlocks it).
- **In use:** the critic flags voice drift, characters who sound alike, uniformly eloquent dialogue, emotional jumps and pacing problems.

**Feedback scopes:** every statement is classified as *chapter*, *character*, *story* or *global*, and you can change the classification before applying.
- Chapter feedback revises that chapter only and is never carried forward.
- A global or story theme becomes a candidate after 2 notes and an active preference after 3 notes across 2 or more chapters. A low rating on its own changes nothing.
- Character feedback about voice becomes a suggested voice note that you accept or reject. It never activates by itself.

Everything the AI remembers can be viewed, edited or deleted on the **Memory** page.

## Testing

```bash
npm test             # all suites (unit + integration + 25-chapter e2e), in-memory PGlite, local provider
npm run test:e2e     # just the 25-chapter novel
npm run typecheck && npm run lint
```

The suites cover:
- auth, sessions and rate limits
- cross-user isolation for every entity
- novels, story bible, chapters and non-destructive versioning (autosave forks canon)
- chunking and the embedding cache
- retrieval and budget, including early-chapter recall after many chapters
- voice profiles, prompt rendering and generation
- continuity rules (required/forbidden events, dead characters, location jumps, canon contradictions)
- the critic
- feedback scopes, revision proposals and preference promotion
- local extraction and the conflict policy
- the approval transaction, retraction, extraction failure and retry
- conflict resolution, memory editing and the assistant modes
- provider adapters (mocked HTTP/SDK)

The e2e test drives generate → rate → revise → write → approve for 24 chapters, then checks:
- a chapter-2 fact is retrieved for chapter 25
- context size stays flat
- memory came only from canon
- the two main voices differ
- a repeated global preference was promoted
- every version and rating was kept
- no retrieval leaks across users

`node scripts/ui-smoke.mjs shell` is an optional headless browser smoke test against a running dev server (needs `npx playwright install chromium`).

## Security

- Every service call resolves ownership through `novels.owner_id`. Another user's resource returns 404, never 403, so no existence is leaked.
- All inputs are validated with zod, with length caps (chapter text ≤ 200k characters).
- Rate limits cover AI operations and sign-in/registration.
- Sessions are stored hashed. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
- User and canon text is fenced in prompts so it cannot act as instructions. User text is rendered as text, never as HTML.

## Cost control

- Embeddings are cached by content hash and model.
- Summaries are computed once per approved version.
- The context budget caps prompt size.
- A cheaper model tier handles summaries, extraction and analysis.
- Every AI call is recorded in `ai_usage` and shown in the header, the dashboard and Settings (marked "estimated" for the local provider).

## Known limitations

- The offline provider writes scaffolds, not prose, and its rule-based extraction is conservative. It prefers missing a fact to inventing one.
- Retrieval uses exact vector search per novel. That is fine for thousands of passages; add an HNSW index for much larger corpora.
- Single-author workspace: there is no multi-user collaboration on one novel.
