import { describe, it, expect } from 'vitest';
import { extractFactsLocal } from '@/server/ai/providers/local/extract';

const known = {
  characters: [{ id: 'm', name: 'Mira Vale', aliases: ['Mira'] }, { id: 'b', name: 'Bram Holt', aliases: ['Bram'] }],
  locations: [{ id: 'g', name: "Gull's Rest" }], factions: [], worldRules: [], objects: [],
};
const TEXT = [
  'Mira arrived at Vey Harbor before dawn. The Grey Guild owned every pier.',
  '“You’re late,” Tovin Rask said. Tovin Rask was a broker for the Grey Guild.',
  'Mira distrusts Bram now. Bram secretly loves Mira, though he would never admit it.',
  'No one can break an Ash Oath without dying.',
  'At the harbor Mira found the Starlight Key hidden in a crate.',
  'Bram was killed by the Guild’s knives at midnight.',
  'It was revealed that Tovin Rask had been the informant all along.',
].join('\n\n');

describe('local extraction', () => {
  const f = extractFactsLocal({ text: TEXT, chapterNumber: 7, known });
  it('finds new characters, locations, factions, objects', () => {
    expect(f.characters.some((c) => c.name === 'Tovin Rask')).toBe(true);
    expect(f.locations.map((l) => l.name)).toContain('Vey Harbor');
    expect(f.factions.map((x) => x.name)).toContain('Grey Guild');
    expect(f.objects.map((x) => x.name)).toContain('Starlight Key');
    expect(f.locations.map((l) => l.name)).not.toContain("Gull's Rest"); // not mentioned
  });
  it('captures state changes for known characters', () => {
    expect(f.characters.find((c) => c.name === 'Mira Vale')?.locationName).toBe('Vey Harbor');
    expect(f.characters.find((c) => c.name === 'Bram Holt')?.status).toBe('dead');
  });
  it('captures directed relationships with secrecy', () => {
    expect(f.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'Mira Vale', to: 'Bram Holt', type: 'distrusts' }),
      expect.objectContaining({ from: 'Bram Holt', to: 'Mira Vale', type: 'secretly loves', isSecret: true }),
    ]));
  });
  it('captures world rules, events and revelations', () => {
    expect(f.worldRules[0].category).toBe('magic');
    expect(f.events.some((e) => e.description.includes('Starlight Key'))).toBe(true);
    expect(f.events.find((e) => e.description.includes('killed'))?.importance).toBe(3);
    expect(f.revelations[0]).toContain('informant');
  });
});
