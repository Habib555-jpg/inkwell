import { describe, it, expect } from 'vitest';
import { hashEmbed, cosine, LocalEmbeddingProvider, LOCAL_EMBED_DIM } from '@/server/ai/providers/local/embedder';

describe('local hashing embedder', () => {
  it('is deterministic, normalized, fixed-size', () => {
    const a = hashEmbed('Mira hid the Starlight Key beneath the lighthouse.');
    expect(a).toHaveLength(LOCAL_EMBED_DIM);
    expect(a).toEqual(hashEmbed('Mira hid the Starlight Key beneath the lighthouse.'));
    expect(Math.hypot(...a)).toBeCloseTo(1, 5);
  });
  it('ranks related text above unrelated text', () => {
    const q = hashEmbed('Mira must retrieve the Starlight Key');
    const rel = hashEmbed('Mira hid the Starlight Key beneath the old lighthouse at Gull’s Rest.');
    const unrel = hashEmbed('The council debated grain taxes for hours in the capital.');
    expect(cosine(q, rel)).toBeGreaterThan(cosine(q, unrel) + 0.2);
  });
  it('handles empty text without NaN', () => {
    expect(hashEmbed('').every(Number.isFinite)).toBe(true);
  });
  it('provider reports estimated usage', async () => {
    const r = await new LocalEmbeddingProvider().embed(['a b c']);
    expect(r.value[0]).toHaveLength(LOCAL_EMBED_DIM);
    expect(r.usage.estimated).toBe(true);
  });
});
