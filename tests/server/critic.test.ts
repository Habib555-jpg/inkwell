import { describe, it, expect } from 'vitest';
import { runCritic } from '@/server/pipeline/critic';
import { samplePack } from '../helpers/pack';

const withVoice = () => {
  const p = samplePack();
  p.characters[0].voice = { ...p.characters[0].voice, lineCount: 12, formality: 0.25, avgWordsPerLine: 4, avoid: ['indeed'] };
  p.characters[1].voice = { ...p.characters[1].voice, lineCount: 12, formality: 0.8, avgWordsPerLine: 9 };
  return p;
};

describe('critic', () => {
  it('always returns metrics, never an empty verdict', () => {
    const r = runCritic('Mira retrieves the Starlight Key. Bram follows her.', samplePack());
    expect(r.metrics.wordCount).toBeGreaterThan(0);
    expect(r.summary.length).toBeGreaterThan(0);
  });
  it('detects voice drift (casual character turned formal, avoid word used)', () => {
    const draft = ['“Indeed, I do not believe that is a wise course of action at this juncture,” Mira said.', '“It is imperative that we proceed with caution, as I have indeed said,” Mira said.'].join('\n\n');
    const r = runCritic(draft, withVoice());
    const d = r.issues.filter((i) => i.category === 'voice_drift');
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].characterId).toBe('m');
  });
  it('detects voices that sound alike', () => {
    const lines = ['I do not know what you mean.', 'That is not how this works.', 'We should leave before dawn.'];
    const draft = lines.flatMap((l) => [`“${l}” Mira said.`, `“${l}” Bram said.`]).join('\n\n');
    expect(runCritic(draft, samplePack()).issues.some((i) => i.category === 'voices_too_similar')).toBe(true);
  });
  it('detects uniform eloquence', () => {
    const long = 'The truth of our destiny is written in the stars, and every soul must eventually confront the meaning of its own existence.';
    const draft = [1, 2, 3, 4].map((i) => `“${long}” ${i % 2 ? 'Mira' : 'Bram'} said.`).join('\n\n');
    expect(runCritic(draft, samplePack()).issues.some((i) => i.category === 'uniform_eloquence')).toBe(true);
  });
  it('detects emotional discontinuity without a bridge', () => {
    const p = samplePack();
    p.characters[0].currentStatus = 'grieving';
    p.characters[0].recentEvents = ['Ch 24: Mira wept at her brother’s funeral; grief hollowed her.'];
    expect(runCritic('Mira laughed and grinned, delighted, happy as a child.', p).issues.some((i) => i.category === 'emotional_discontinuity')).toBe(true);
    expect(runCritic('Weeks later, Mira finally laughed and grinned, delighted.', p).issues.some((i) => i.category === 'emotional_discontinuity')).toBe(false);
  });
  it('flags pacing length and dialogue ratio against settings', () => {
    const p = samplePack(); p.novel.dialogueBalance = 'dialogue_heavy';
    const r = runCritic('Mira retrieves the Starlight Key. Bram follows her. The night was long.', p);
    expect(r.issues.some((i) => i.category === 'pacing_length')).toBe(true);
    expect(r.issues.some((i) => i.category === 'pacing_dialogue_ratio')).toBe(true);
  });
  it('flags repetition', () => {
    const draft = Array.from({ length: 5 }, () => 'She turned toward the sea and waited.').join(' ');
    expect(runCritic(draft, samplePack()).issues.some((i) => i.category === 'repetition')).toBe(true);
  });
});
