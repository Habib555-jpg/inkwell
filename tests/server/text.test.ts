import { describe, it, expect } from 'vitest';
import { splitSentences, contentTokens, tokenOverlap, properNouns, splitParagraphs } from '@/server/text/tokenize';
import { attributeDialogue, findQuotes } from '@/server/text/dialogue';
import { dominantEmotion } from '@/server/text/emotion';
import { lineStats, applyContractions, expandContractions, dialogueRatio } from '@/server/text/style';
import { extractiveSummary, extractKeywords } from '@/server/ai/providers/local/summarize';

const cast = [
  { id: 'm', names: ['Mira Vale', 'Mira'] },
  { id: 'b', names: ['Bram'] },
  { id: 'e', names: ['Élodie'] },
];

describe('tokenize', () => {
  it('splits sentences including after closing quotes', () => {
    expect(splitSentences('He left. “Wait!” she said. Then silence.')).toHaveLength(3);
  });
  it('stems and drops stopwords', () => {
    expect(contentTokens('The guards were running toward the gates')).toEqual(['guard', 'runn', 'toward', 'gate']);
  });
  it('maps irregular verbs to their base form', () => {
    expect(contentTokens('Mira stole the crown; Bram died')).toEqual(contentTokens('Mira steals the crown; Bram dies'));
  });
  it('measures overlap of a requirement against text', () => {
    expect(tokenOverlap('Mira steals the crown', 'At midnight Mira stole into the vault and took the crown.')).toBeGreaterThanOrEqual(0.66);
    expect(tokenOverlap('Bram dies', 'Everyone lived happily.')).toBe(0);
  });
  it('finds multi-word proper nouns and ignores sentence-initial-only words', () => {
    const p = properNouns("They rode to Gull's Rest. At Gull's Rest the tide was high. Night fell.");
    expect(p.get("Gull's Rest")?.count).toBe(2);
    expect(p.has('Night')).toBe(false);
  });
  it('splits paragraphs on blank lines', () => {
    expect(splitParagraphs('a\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
  });
});

describe('dialogue attribution', () => {
  it('attributes via trailing and leading speech tags', () => {
    const t = '“We move at dawn,” Mira said.\n\nBram asked, “And the guards?”';
    expect(attributeDialogue(t, cast).map((l) => l.speakerId)).toEqual(['m', 'b']);
  });
  it('handles curly quotes and accented names', () => {
    const [line] = attributeDialogue('“Je reste ici,” murmured Élodie. Bram shrugged.', cast);
    expect(line.speakerId).toBe('e');
    expect(line.text).toBe('Je reste ici,');
  });
  it('falls back to the sole named actor in the paragraph', () => {
    const [line] = attributeDialogue('Mira leaned on the rail. “Figures.”', cast);
    expect(line.speakerId).toBe('m');
  });
  it('leaves ambiguous lines unattributed', () => {
    const [line] = attributeDialogue('Mira looked at Bram. “Now.”', cast);
    expect(line.speakerId).toBeNull();
  });
  it('detects a vocative addressee', () => {
    const [line] = attributeDialogue('“Bram, stop,” Mira said.', cast);
    expect(line.addresseeId).toBe('b');
  });
  it('finds straight and curly quotes', () => {
    expect(findQuotes('"A" and “B”').map((q) => q.text)).toEqual(['A', 'B']);
  });
});

describe('style & emotion', () => {
  it('scores casual vs formal speech', () => {
    const casual = lineStats(["Yeah, I don't know.", 'Gonna be fine.', "Can't stop now."]);
    const formal = lineStats(['I do not believe that is wise, sir.', 'Indeed, we must proceed with caution.', 'Perhaps you are correct.']);
    expect(casual.formality).toBeLessThan(0.4);
    expect(formal.formality).toBeGreaterThan(0.6);
    expect(casual.contractionRate).toBeGreaterThan(formal.contractionRate);
  });
  it('contracts and expands', () => {
    expect(applyContractions('I do not know. It is late.')).toBe("I don't know. It's late.");
    expect(expandContractions("I don't know. It's late.")).toBe('I do not know. It is late.');
  });
  it('computes dialogue ratio by words', () => {
    expect(dialogueRatio('“One two three four,” she said. Five six seven eight.')).toBeCloseTo(0.4, 1);
  });
  it('detects dominant emotion', () => {
    expect(dominantEmotion('She wept at the funeral, grief hollowing her; the tears would not stop.')).toBe('sadness');
    expect(dominantEmotion('The room was plain.')).toBeNull();
  });
});

describe('local summarizer', () => {
  it('keeps salient sentences within the word budget, in order', () => {
    const text = 'Mira reached the harbor at dawn. The gulls were loud. Mira hid the Starlight Key beneath the lighthouse. Bram waited by the boats. Nothing else happened.';
    const s = extractiveSummary(text, 20);
    expect(s).toContain('Starlight Key');
    expect(s.split(/\s+/).length).toBeLessThanOrEqual(20);
  });
  it('extracts keywords preferring proper nouns', () => {
    const k = extractKeywords('Mira hid the Starlight Key. The Starlight Key glowed. Mira ran.', 5);
    expect(k).toContain('Starlight Key');
    expect(k).toContain('Mira');
  });
});
