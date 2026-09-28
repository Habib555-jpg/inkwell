import type { Env } from '../env';
import type { AIProvider, EmbeddingProvider } from './types';
import { LocalProvider } from './providers/local';
import { LocalEmbeddingProvider } from './providers/local/embedder';
import { ConfigError } from '../errors';

export function createProviders(env: Env): { ai: AIProvider; embedder: EmbeddingProvider } {
  if (env.AI_PROVIDER !== 'local' || env.EMBEDDING_PROVIDER !== 'local') throw new ConfigError('Keyed providers are wired in Task 10');
  return { ai: new LocalProvider(), embedder: new LocalEmbeddingProvider() };
}
