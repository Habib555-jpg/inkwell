import { describe, it, expect } from 'vitest';
import { buildDraftPrompt } from '@/server/ai/prompts/chapter';
import { renderLocalDraft, LOCAL_DRAFT_LABEL, shapeLine } from '@/server/ai/providers/local/draft';
import { samplePack, voice } from '../helpers/pack';

describe('draft prompt', () => {
  it('encodes priorities, voice contracts, fenced canon, and requirements', () => {
    const p = buildDraftPrompt(samplePack());
    expect(p.system).toMatch(/1\. Continuity[\s\S]*2\. Character voice[\s\S]*3\. Emotional consistency[\s\S]*4\. Natural dialogue[\s\S]*5\. Pacing/);
    const u = p.messages[0].content;
    expect(u).toContain('<relevant_canon>');
    expect(u).toContain('[Chapter 2]');
    expect(u).toContain('Never uses: indeed');
    expect(u).toContain('“Figures.”');
    expect(u).toContain('MUST NOT happen');
    expect(u).toContain('Keep dialogue informal.');
  });
});

describe('local draft', () => {
  it('is labeled, covers each required event as a scene, and never includes forbidden events', () => {
    const d = renderLocalDraft(samplePack());
    expect(d.startsWith(LOCAL_DRAFT_LABEL)).toBe(true);
    expect(d).toContain('Chapter 25: The Key');
    expect(d).toContain('Scene 1 — Mira retrieves the Starlight Key');
    expect(d).toContain('Scene 2 — Bram follows her');
    expect(d).not.toContain('Mira dies');
  });
  it('shapes quoted dialogue by voice (casual → contractions, tic on first line)', () => {
    expect(shapeLine('I do not trust you, Bram', voice(), true)).toBe("Figures, I don't trust you, Bram");
    expect(shapeLine("I don't know", voice({ register: 'formal', verbalTics: [] }), false)).toBe('I do not know');
    expect(shapeLine('That is indeed odd', voice(), false)).toBe("That's odd");
  });
});
