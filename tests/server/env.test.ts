import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadEnv } from '@/server/env';
import { ConfigError } from '@/server/errors';

describe('loadEnv', () => {
  it('defaults to keyless local providers and PGlite', () => {
    const env = loadEnv({});
    expect(env.AI_PROVIDER).toBe('local');
    expect(env.EMBEDDING_PROVIDER).toBe('local');
    expect(env.DATABASE_URL).toBeUndefined();
    // embedded Postgres lives in a per-user local data folder, never inside the (possibly cloud-synced) project
    expect(path.isAbsolute(env.PGLITE_DIR)).toBe(true);
    expect(env.PGLITE_DIR.startsWith(process.cwd())).toBe(false);
    expect(env.PGLITE_DIR).toMatch(/Inkwell[\\/]pglite$/i);
    expect(env.AI_RATE_LIMIT_PER_MIN).toBe(30);
    expect(env.ANTHROPIC_SERVER_FALLBACK).toBe('default');
  });
  it('uses LOCALAPPDATA on Windows and honors an explicit PGLITE_DIR', () => {
    expect(loadEnv({ LOCALAPPDATA: String.raw`C:\Users\x\AppData\Local` }, 'win32').PGLITE_DIR.replaceAll('\\', '/')).toBe('C:/Users/x/AppData/Local/Inkwell/pglite');
    expect(loadEnv({ PGLITE_DIR: './custom-db' }).PGLITE_DIR).toBe('./custom-db');
  });
  it('throws ConfigError naming the missing key for anthropic', () => {
    expect(() => loadEnv({ AI_PROVIDER: 'anthropic' })).toThrow(ConfigError);
    expect(() => loadEnv({ AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });
  it('throws for openai embeddings without key', () => {
    expect(() => loadEnv({ EMBEDDING_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });
  it('accepts anthropic with key and local embeddings', () => {
    const env = loadEnv({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' });
    expect(env.AI_PROVIDER).toBe('anthropic');
  });
  it('lets the Anthropic server-side fallback be turned off', () => {
    expect(loadEnv({ ANTHROPIC_SERVER_FALLBACK: 'off' }).ANTHROPIC_SERVER_FALLBACK).toBe('off');
  });
  it('rejects unknown provider names', () => {
    expect(() => loadEnv({ AI_PROVIDER: 'nope' })).toThrow(ConfigError);
  });
});
