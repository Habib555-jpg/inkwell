import type { Env } from '../env';
import { DEFAULT_MODELS } from './registry';
export function getProviderStatus(env: Env) {
  const d = env.AI_PROVIDER === 'local' ? null : DEFAULT_MODELS[env.AI_PROVIDER];
  const embedDefault = env.EMBEDDING_PROVIDER === 'local' ? 'local-hash-384' : DEFAULT_MODELS[env.EMBEDDING_PROVIDER].embed;
  return {
    aiProvider: env.AI_PROVIDER,
    mainModel: env.AI_MODEL ?? d?.main ?? 'local-rules-v1',
    fastModel: env.AI_MODEL_FAST ?? env.AI_MODEL ?? d?.fast ?? 'local-rules-v1',
    embeddingProvider: env.EMBEDDING_PROVIDER,
    embeddingModel: env.EMBEDDING_MODEL ?? embedDefault,
    keyConfigured: { anthropic: !!env.ANTHROPIC_API_KEY, openai: !!env.OPENAI_API_KEY, gemini: !!env.GEMINI_API_KEY },
    local: env.AI_PROVIDER === 'local',
    anthropicServerFallback: env.ANTHROPIC_SERVER_FALLBACK,
  };
}
