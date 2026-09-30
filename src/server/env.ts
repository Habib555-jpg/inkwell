import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { ConfigError } from './errors';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().optional(),
  DB_AUTO_MIGRATE: z.enum(['true', 'false']).default('true'),
  AI_PROVIDER: z.enum(['local', 'ollama', 'anthropic', 'openai', 'gemini']).default('local'),
  AI_MODEL: z.string().optional(),
  AI_MODEL_FAST: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['local', 'ollama', 'openai', 'gemini']).default('local'),
  EMBEDDING_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Anthropic server-side refusal fallback: "default" lets the API pick a fallback model, "off" disables it. */
  ANTHROPIC_SERVER_FALLBACK: z.enum(['default', 'off']).default('default'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** Free key from https://aistudio.google.com/apikey — used by AI_PROVIDER / EMBEDDING_PROVIDER = gemini. */
  GEMINI_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
export type Env = Omit<z.infer<typeof schema>, 'PGLITE_DIR'> & { PGLITE_DIR: string };

/**
 * Default home of the embedded database: a per-user local data folder, never inside the project, because projects often
 * live in cloud-synced folders (OneDrive/Dropbox) that lock files or mark them read-only, which corrupts a live Postgres.
 */
export function defaultPgliteDir(source: Record<string, string | undefined>, platform: NodeJS.Platform = process.platform): string {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const home = os.homedir();
  if (platform === 'win32') return p.join(source.LOCALAPPDATA ?? p.join(home, 'AppData', 'Local'), 'Inkwell', 'pglite');
  if (platform === 'darwin') return p.join(home, 'Library', 'Application Support', 'Inkwell', 'pglite');
  return p.join(source.XDG_DATA_HOME ?? p.join(home, '.local', 'share'), 'Inkwell', 'pglite');
}

export function loadEnv(source: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid environment configuration — ${msg}`);
  }
  const env: Env = { ...parsed.data, PGLITE_DIR: parsed.data.PGLITE_DIR ?? defaultPgliteDir(source, platform) };
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY)
    throw new ConfigError('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY');
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY)
    throw new ConfigError('AI_PROVIDER=openai requires OPENAI_API_KEY');
  if (env.EMBEDDING_PROVIDER === 'openai' && !env.OPENAI_API_KEY)
    throw new ConfigError('EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY');
  if ((env.AI_PROVIDER === 'gemini' || env.EMBEDDING_PROVIDER === 'gemini') && !env.GEMINI_API_KEY)
    throw new ConfigError('The gemini provider requires GEMINI_API_KEY (free at https://aistudio.google.com/apikey)');
  return env;
}

let cached: Env | undefined;
export function getEnv(): Env {
  return (cached ??= loadEnv());
}
