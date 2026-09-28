import type { Env } from '../env';
import type { AIProvider, EmbeddingProvider } from './types';
import { LocalProvider } from './providers/local';
import { LocalEmbeddingProvider } from './providers/local/embedder';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider, OpenAIEmbeddingProvider } from './providers/openai';
import { OllamaProvider, OllamaEmbeddingProvider } from './providers/ollama';

export const DEFAULT_MODELS = {
  anthropic: { main: 'claude-opus-5', fast: 'claude-haiku-4-5' },
  openai: { main: 'gpt-5', fast: 'gpt-5-mini', embed: 'text-embedding-3-small' },
  ollama: { main: 'llama3.1', fast: 'llama3.1', embed: 'nomic-embed-text' },
} as const;

export function createProviders(env: Env): { ai: AIProvider; embedder: EmbeddingProvider } {
  const pick = (d: { main: string; fast: string }) => ({ main: env.AI_MODEL ?? d.main, fast: env.AI_MODEL_FAST ?? env.AI_MODEL ?? d.fast });
  const ai: AIProvider =
    env.AI_PROVIDER === 'anthropic' ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY!, serverFallback: env.ANTHROPIC_SERVER_FALLBACK, ...pick(DEFAULT_MODELS.anthropic) })
    : env.AI_PROVIDER === 'openai' ? new OpenAIProvider({ apiKey: env.OPENAI_API_KEY!, ...pick(DEFAULT_MODELS.openai) })
    : env.AI_PROVIDER === 'ollama' ? new OllamaProvider({ baseUrl: env.OLLAMA_BASE_URL, ...pick(DEFAULT_MODELS.ollama) })
    : new LocalProvider();
  const embedder: EmbeddingProvider =
    env.EMBEDDING_PROVIDER === 'openai' ? new OpenAIEmbeddingProvider(env.EMBEDDING_MODEL ?? DEFAULT_MODELS.openai.embed, env.OPENAI_API_KEY!)
    : env.EMBEDDING_PROVIDER === 'ollama' ? new OllamaEmbeddingProvider({ baseUrl: env.OLLAMA_BASE_URL, model: env.EMBEDDING_MODEL ?? DEFAULT_MODELS.ollama.embed })
    : new LocalEmbeddingProvider();
  return { ai, embedder };
}
