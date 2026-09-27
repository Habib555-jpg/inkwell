import { z } from 'zod';
import { ConfigError } from './errors';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().default('./.data/pglite'),
  DB_AUTO_MIGRATE: z.enum(['true', 'false']).default('true'),
  AI_PROVIDER: z.enum(['local', 'ollama', 'anthropic', 'openai']).default('local'),
  AI_MODEL: z.string().optional(),
  AI_MODEL_FAST: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['local', 'ollama', 'openai']).default('local'),
  EMBEDDING_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Anthropic server-side refusal fallback: "default" lets the API pick a fallback model, "off" disables it. */
  ANTHROPIC_SERVER_FALLBACK: z.enum(['default', 'off']).default('default'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid environment configuration — ${msg}`);
  }
  const env = parsed.data;
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY)
    throw new ConfigError('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY');
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY)
    throw new ConfigError('AI_PROVIDER=openai requires OPENAI_API_KEY');
  if (env.EMBEDDING_PROVIDER === 'openai' && !env.OPENAI_API_KEY)
    throw new ConfigError('EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY');
  return env;
}

let cached: Env | undefined;
export function getEnv(): Env {
  return (cached ??= loadEnv());
}
