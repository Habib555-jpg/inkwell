import { describe, it, expect } from 'vitest';
import { createProviders } from '@/server/ai/registry';
import { loadEnv } from '@/server/env';

describe('provider registry', () => {
  it('defaults to local providers without keys', () => {
    const { ai, embedder } = createProviders(loadEnv({}));
    expect(ai.id).toBe('local');
    expect(embedder.id).toBe('local');
    expect(embedder.model).toBe('local-hash-384');
  });
  it('builds keyed providers when keys exist', () => {   // un-skip in Task 10
    const { ai } = createProviders(loadEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }));
    expect(ai.id).toBe('anthropic');
    expect(ai.model('main')).toBe('claude-opus-5');
    expect(ai.model('fast')).toBe('claude-haiku-4-5');
  });
  it('honors model overrides', () => {                     // un-skip in Task 10
    const { ai } = createProviders(loadEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', AI_MODEL: 'm1', AI_MODEL_FAST: 'm2' }));
    expect([ai.model('main'), ai.model('fast')]).toEqual(['m1', 'm2']);
  });
});
