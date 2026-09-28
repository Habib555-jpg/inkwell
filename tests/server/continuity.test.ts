import { describe, it, expect } from 'vitest';
import { ruleContinuity, checkRequiredEvents } from '@/server/pipeline/continuity';
import { samplePack } from '../helpers/pack';

const base = (draft: string, over: Partial<Parameters<typeof ruleContinuity>[0]> = {}) => ({
  draft, pack: samplePack(),
  characters: [
    { id: 'm', name: 'Mira Vale', aliases: ['Mira'], currentStatus: '', currentLocation: "Gull's Rest" },
    { id: 'b', name: 'Bram Holt', aliases: ['Bram'], currentStatus: 'dead — killed in chapter 12', currentLocation: null },
    { id: 'a', name: 'Alex', aliases: [], currentStatus: '', currentLocation: null },
  ],
  knownNames: ['Mira Vale', 'Mira', 'Bram Holt', 'Bram', 'Alex', "Gull's Rest", 'Vey Harbor', 'the capital'],
  locationNames: ["Gull's Rest", 'Vey Harbor'],
  canonSearch: async () => [{ chunkId: 'c3', chapterNumber: 3, content: 'Alex spent three years in the capital before the war.', score: 0.9 }],
  ...over,
});

describe('continuity rules', () => {
  it('flags missing required events and passes present ones', () => {
    const issues = checkRequiredEvents('Mira pried up the stone and took the Starlight Key.', ['Mira retrieves the Starlight Key', 'Bram follows her']);
    expect(issues.map((i) => i.category)).toEqual(['missing_required_event']);
    expect(issues[0].message).toContain('Bram follows her');
  });
  it('flags forbidden events but not negated mentions', async () => {
    const bad = await ruleContinuity(base('The arrow struck true. Mira dies on the cliff.'));
    expect(bad.some((i) => i.category === 'forbidden_event_present')).toBe(true);
    const ok = await ruleContinuity(base('Mira nearly dies on the cliff, but Bram hauls her up.'));
    expect(ok.some((i) => i.category === 'forbidden_event_present')).toBe(false);
  });
  it('flags dead characters acting, not being remembered', async () => {
    expect((await ruleContinuity(base('“Hold the line,” Bram said.'))).some((i) => i.category === 'dead_character_acts')).toBe(true);
    expect((await ruleContinuity(base('Mira remembered how Bram laughed at the funeral of his father.'))).some((i) => i.category === 'dead_character_acts')).toBe(false);
  });
  it('flags location jumps without travel', async () => {
    const r = await ruleContinuity(base('Mira stood on the docks of Vey Harbor and watched the ships.'));
    expect(r.some((i) => i.category === 'location_jump')).toBe(true);
    const ok = await ruleContinuity(base('Mira rode south for two days. Mira reached Vey Harbor at dawn.'));
    expect(ok.some((i) => i.category === 'location_jump')).toBe(false);
  });
  it('flags contradictions with canon (spec example)', async () => {
    const r = await ruleContinuity(base('Alex had never visited the capital.'));
    const c = r.find((i) => i.category === 'canon_contradiction');
    expect(c?.evidence?.chapterNumber).toBe(3);
    expect(c?.evidence?.quote).toContain('three years in the capital');
  });
  it('reports unknown names as info', async () => {
    const r = await ruleContinuity(base('Mira met a stranger. Later, Tovin Rask offered her a job, and Tovin Rask smiled.'));
    expect(r.find((i) => i.category === 'new_entity')?.severity).toBe('info');
  });
});
