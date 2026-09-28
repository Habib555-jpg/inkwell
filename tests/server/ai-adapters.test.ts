import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { parseJsonLoose } from '@/server/ai/json';
import { OllamaProvider, OllamaEmbeddingProvider } from '@/server/ai/providers/ollama';
import { OpenAIProvider } from '@/server/ai/providers/openai';
import { AnthropicProvider } from '@/server/ai/providers/anthropic';
import { AIError } from '@/server/errors';

const task = { kind: 'feedback_analysis' as const, input: { answers: {} as never, rating: 5, chapterNumber: 1, characters: [] } };
const res = (body: unknown) => new Response(JSON.stringify(body));

describe('parseJsonLoose', () => {
  it('strips fences and prose', () => {
    expect(parseJsonLoose('Here:\n```json\n{"a":1}\n```\nthanks')).toEqual({ a: 1 });
    expect(parseJsonLoose('{"b":[1,2]}')).toEqual({ b: [1, 2] });
  });
});

describe('Ollama adapter (mocked fetch)', () => {
  it('generates text and reports usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({ message: { content: 'Draft.' }, prompt_eval_count: 12, eval_count: 3 }));
    const p = new OllamaProvider({ baseUrl: 'http://x', main: 'llama', fast: 'llama', fetch: fetchMock });
    const r = await p.generateText({ system: 's', messages: [{ role: 'user', content: 'u' }], task: { kind: 'assistant', mode: 'brainstorm', pack: null, message: 'u', draft: null } });
    expect(r.value).toBe('Draft.');
    expect(r.usage).toEqual({ inputTokens: 12, outputTokens: 3, estimated: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0]).toEqual({ role: 'system', content: 's' });
  });
  it('repairs invalid JSON once, then fails with AIError', async () => {
    const schema = z.object({ ok: z.boolean() });
    const good = vi.fn().mockResolvedValueOnce(res({ message: { content: 'not json' } })).mockResolvedValueOnce(res({ message: { content: '{"ok":true}' } }));
    const p = new OllamaProvider({ baseUrl: 'http://x', main: 'm', fast: 'm', fetch: good });
    expect((await p.analyzeText({ system: 's', messages: [{ role: 'user', content: 'u' }], schema, task })).value).toEqual({ ok: true });
    const bad = vi.fn().mockImplementation(async () => res({ message: { content: 'nope' } }));
    const p2 = new OllamaProvider({ baseUrl: 'http://x', main: 'm', fast: 'm', fetch: bad });
    await expect(p2.analyzeText({ system: 's', messages: [{ role: 'user', content: 'u' }], schema, task })).rejects.toBeInstanceOf(AIError);
  });
  it('embeds', async () => {
    const e = new OllamaEmbeddingProvider({ baseUrl: 'http://x', model: 'nomic-embed-text', fetch: vi.fn().mockResolvedValue(res({ embeddings: [[0.1, 0.2]] })) });
    expect((await e.embed(['hi'])).value).toEqual([[0.1, 0.2]]);
  });
  it('wraps network failures in AIError', async () => {
    const p = new OllamaProvider({ baseUrl: 'http://x', main: 'm', fast: 'm', fetch: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
    await expect(p.summarize('text')).rejects.toBeInstanceOf(AIError);
  });
});

describe('OpenAI adapter (injected client)', () => {
  it('maps chat completion + usage and uses the fast model for summaries', async () => {
    const client = { chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'Hi' } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }) } } };
    const p = new OpenAIProvider({ apiKey: 'k', main: 'm', fast: 'f', client: client as never });
    const r = await p.summarize('text');
    expect(r.value).toBe('Hi');
    expect(client.chat.completions.create.mock.calls[0][0].model).toBe('f');
    expect(r.usage.estimated).toBe(false);
  });
});

describe('Anthropic adapter (injected client)', () => {
  const message = (over: Record<string, unknown> = {}) => ({
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Chapter text.' }],
    stop_reason: 'end_turn', usage: { input_tokens: 40, output_tokens: 9 }, ...over,
  });
  const fakeClient = (msg = message()) => {
    const stream = vi.fn().mockReturnValue({ finalMessage: async () => msg });
    const betaStream = vi.fn().mockReturnValue({ finalMessage: async () => msg });
    return { client: { messages: { stream, parse: vi.fn() }, beta: { messages: { stream: betaStream } } }, stream, betaStream };
  };
  const req = { system: 's', messages: [{ role: 'user' as const, content: 'u' }], task: { kind: 'assistant' as const, mode: 'brainstorm' as const, pack: null, message: 'u', draft: null } };

  it('returns text blocks only and real usage', async () => {
    const f = fakeClient();
    const p = new AnthropicProvider({ apiKey: 'k', main: 'claude-opus-5', fast: 'claude-haiku-4-5', serverFallback: 'off', client: f.client as never });
    const r = await p.generateText(req);
    expect(r.value).toBe('Chapter text.');
    expect(r.usage).toEqual({ inputTokens: 40, outputTokens: 9, estimated: false });
    expect(r.model).toBe('claude-opus-5');
  });
  it('uses the server-side fallback on supported models when ANTHROPIC_SERVER_FALLBACK=default', async () => {
    const f = fakeClient();
    const p = new AnthropicProvider({ apiKey: 'k', main: 'claude-opus-5', fast: 'claude-haiku-4-5', serverFallback: 'default', client: f.client as never });
    await p.generateText(req);
    expect(f.betaStream).toHaveBeenCalledTimes(1);
    expect(f.betaStream.mock.calls[0][0]).toMatchObject({ fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] });
    expect(f.stream).not.toHaveBeenCalled();
  });
  it('never sends fallbacks when ANTHROPIC_SERVER_FALLBACK=off', async () => {
    const f = fakeClient();
    const p = new AnthropicProvider({ apiKey: 'k', main: 'claude-opus-5', fast: 'claude-haiku-4-5', serverFallback: 'off', client: f.client as never });
    await p.generateText(req);
    expect(f.betaStream).not.toHaveBeenCalled();
    expect(f.stream.mock.calls[0][0]).not.toHaveProperty('fallbacks');
  });
  it('does not send fallbacks or adaptive thinking to Haiku', async () => {
    const f = fakeClient();
    const p = new AnthropicProvider({ apiKey: 'k', main: 'claude-haiku-4-5', fast: 'claude-haiku-4-5', serverFallback: 'default', client: f.client as never });
    await p.generateText(req);
    expect(f.betaStream).not.toHaveBeenCalled();
    expect(f.stream.mock.calls[0][0]).not.toHaveProperty('thinking');
  });
  it('turns a refusal into an AIError', async () => {
    const f = fakeClient(message({ stop_reason: 'refusal' }));
    const p = new AnthropicProvider({ apiKey: 'k', main: 'claude-opus-5', fast: 'claude-haiku-4-5', serverFallback: 'off', client: f.client as never });
    await expect(p.generateText(req)).rejects.toBeInstanceOf(AIError);
  });
});
