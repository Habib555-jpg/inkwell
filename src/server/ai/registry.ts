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
  // fallbacks: tried in order when the main model is overloaded (free-tier Flash models often return 503)
  gemini: { main: 'gemini-3.8-flash', fast: 'gemini-3.1-flash-lite', embed: 'gemini-embedding-001', fallbacks: ['gemini-3.7-flash', 'gemini-3.1-flash-lite'] },
} as const;
/** Google Gemini's OpenAI-compatible endpoint (free tier with a key from https://aistudio.google.com/apikey). */
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export function createProviders(env: Env): { ai: AIProvider; embedder: EmbeddingProvider } {
  const pick = (d: { main: string; fast: string }) => ({ main: env.AI_MODEL ?? d.main, fast: env.AI_MODEL_FAST ?? env.AI_MODEL ?? d.fast });
  const ai: AIProvider =
    env.AI_PROVIDER === 'anthropic' ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY!, serverFallback: env.ANTHROPIC_SERVER_FALLBACK, ...pick(DEFAULT_MODELS.anthropic) })
    : env.AI_PROVIDER === 'openai' ? new OpenAIProvider({ apiKey: env.OPENAI_API_KEY!, fallbacks: env.AI_MODEL_FALLBACK, ...pick(DEFAULT_MODELS.openai) })
    : env.AI_PROVIDER === 'ollama' ? new OllamaProvider({ baseUrl: env.OLLAMA_BASE_URL, ...pick(DEFAULT_MODELS.ollama) })
    : env.AI_PROVIDER === 'gemini' ? new OpenAIProvider({ apiKey: env.GEMINI_API_KEY!, baseURL: GEMINI_BASE_URL, id: 'gemini', jsonMode: false, fallbacks: env.AI_MODEL_FALLBACK ?? [...DEFAULT_MODELS.gemini.fallbacks], ...pick(DEFAULT_MODELS.gemini) })
    : new LocalProvider();
  const embedder: EmbeddingProvider =
    env.EMBEDDING_PROVIDER === 'openai' ? new OpenAIEmbeddingProvider(env.EMBEDDING_MODEL ?? DEFAULT_MODELS.openai.embed, env.OPENAI_API_KEY!)
    : env.EMBEDDING_PROVIDER === 'ollama' ? new OllamaEmbeddingProvider({ baseUrl: env.OLLAMA_BASE_URL, model: env.EMBEDDING_MODEL ?? DEFAULT_MODELS.ollama.embed })
    : env.EMBEDDING_PROVIDER === 'gemini' ? new OpenAIEmbeddingProvider(env.EMBEDDING_MODEL ?? DEFAULT_MODELS.gemini.embed, env.GEMINI_API_KEY!, undefined, { baseURL: GEMINI_BASE_URL, id: 'gemini' })
    : new LocalEmbeddingProvider();
  return { ai, embedder };
}
