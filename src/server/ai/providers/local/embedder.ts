import type { AIResult, EmbeddingProvider } from '../../types';
import { contentTokens, fnv1a } from '../../../text/tokenize';
import { estimateTokens } from '../../usage';

export const LOCAL_EMBED_DIM = 384;
/** Signed feature hashing of stemmed unigrams + bigrams, sublinear TF, L2-normalized. Deterministic and offline. */
export function hashEmbed(text: string): number[] {
  const v = new Array<number>(LOCAL_EMBED_DIM).fill(0);
  const toks = contentTokens(text);
  const tf = new Map<string, number>();
  toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
  for (let i = 0; i + 1 < toks.length; i++) { const bg = `${toks[i]}_${toks[i + 1]}`; tf.set(bg, (tf.get(bg) ?? 0) + 1); }
  for (const [f, n] of tf) {
    const w = (1 + Math.log(n)) * (f.includes('_') ? 0.5 : 1);
    v[fnv1a(f) % LOCAL_EMBED_DIM] += (fnv1a(f + '#') & 1 ? 1 : -1) * w;
  }
  const norm = Math.hypot(...v);
  if (!norm) { v[0] = 1; return v; }
  return v.map((x) => x / norm);
}
export const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local';
  readonly model = 'local-hash-384';
  async embed(texts: string[]): Promise<AIResult<number[][]>> {
    return {
      value: texts.map(hashEmbed), provider: this.id, model: this.model,
      usage: { inputTokens: texts.reduce((a, t) => a + estimateTokens(t), 0), outputTokens: 0, estimated: true },
    };
  }
}
