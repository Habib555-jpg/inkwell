import { describe, it, expect } from 'vitest';
import { getProviderStatus } from '@/server/ai/status';
import { loadEnv } from '@/server/env';

describe('provider status', () => {
  it('reports local defaults without keys', () => {
    expect(getProviderStatus(loadEnv({}))).toMatchObject({ aiProvider: 'local', embeddingProvider: 'local', local: true, keyConfigured: { anthropic: false, openai: false } });
  });
  it('never exposes key values', () => {
    const st = getProviderStatus(loadEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-secret-123' }));
    expect(JSON.stringify(st)).not.toContain('sk-secret-123');
    expect(st.mainModel).toBe('claude-opus-5');
    expect(st.keyConfigured.anthropic).toBe(true);
    expect(st.anthropicServerFallback).toBe('default');
    expect(getProviderStatus(loadEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', ANTHROPIC_SERVER_FALLBACK: 'off' })).anthropicServerFallback).toBe('off');
  });
});
