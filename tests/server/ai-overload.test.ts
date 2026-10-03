import { describe, it, expect, vi } from 'vitest';
import { OpenAIProvider } from '@/server/ai/providers/openai';
import { AIError, AppError, isAppError } from '@/server/errors';
import { loadEnv } from '@/server/env';
import { createProviders } from '@/server/ai/registry';

const prompt = { system: 's', messages: [{ role: 'user' as const, content: 'u' }], task: { kind: 'assistant' as const, mode: 'brainstorm' as const, pack: null, message: 'u', draft: null } };
const ok = (text: string) => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
// what the OpenAI SDK throws for an overloaded Gemini model
const overloaded = () => Object.assign(new Error('503 This model is currently experiencing high demand.'), { status: 503 });

describe('AI overload handling', () => {
  it('falls back to the next configured model when the main one is overloaded, and reports the model used', async () => {
    const create = vi.fn().mockRejectedValueOnce(overloaded()).mockResolvedValueOnce(ok('Fallback prose.'));
    const p = new OpenAIProvider({ apiKey: 'k', main: 'busy-model', fast: 'f', fallbacks: ['spare-model'], id: 'gemini', client: { chat: { completions: { create } } } as never });
    const r = await p.generateText(prompt);
    expect(r.value).toBe('Fallback prose.');
    expect(r.model).toBe('spare-model');
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(['busy-model', 'spare-model']);
  });

  it('does not fall back on errors that are not overload (e.g. a bad request)', async () => {
    const bad = Object.assign(new Error('400 invalid argument'), { status: 400 });
    const create = vi.fn().mockRejectedValue(bad);
    const p = new OpenAIProvider({ apiKey: 'k', main: 'm', fast: 'f', fallbacks: ['spare'], client: { chat: { completions: { create } } } as never });
    await expect(p.generateText(prompt)).rejects.toBeInstanceOf(AIError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('says plainly that the provider is busy when every model is overloaded', async () => {
    const create = vi.fn().mockRejectedValue(overloaded());
    const p = new OpenAIProvider({ apiKey: 'k', main: 'a', fast: 'f', fallbacks: ['b'], id: 'gemini', client: { chat: { completions: { create } } } as never });
    const err = await p.generateText(prompt).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe('ai_busy');
    expect(err.message).toMatch(/gemini is busy/i);
    expect(err.message).toMatch(/try again/i);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('reads the fallback list from AI_MODEL_FALLBACK (comma-separated)', () => {
    expect(loadEnv({ AI_MODEL_FALLBACK: 'x, y ,z' }).AI_MODEL_FALLBACK).toEqual(['x', 'y', 'z']);
    expect(loadEnv({}).AI_MODEL_FALLBACK).toBeUndefined();
  });

  it('gives Gemini a default fallback chain that AI_MODEL_FALLBACK overrides', () => {
    const fb = (src: Record<string, string>) => (createProviders(loadEnv({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', ...src })).ai as unknown as { models: { fallbacks?: string[] } }).models.fallbacks;
    expect(fb({})).toEqual(['gemini-3.7-flash', 'gemini-3.1-flash-lite']);
    expect(fb({ AI_MODEL_FALLBACK: 'only-this' })).toEqual(['only-this']);
  });
});

describe('isAppError across bundle copies', () => {
  it('recognises an app error created by a second copy of the errors module', async () => {
    // production builds can load errors.ts twice (server-action and page chunks): instanceof then fails
    vi.resetModules();
    const other = await import('@/server/errors');
    expect(other.AppError).not.toBe(AppError);
    const e = new other.AIError('gemini is busy');
    expect(isAppError(e)).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError({ code: 'x', status: 500, message: 'lookalike' })).toBe(false);
  });
});
