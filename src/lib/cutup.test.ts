import { describe, expect, it } from 'vitest';
import { chop } from './cutup';

const TEXT = `The county fair closed early on account of the wind. Nobody got their money back,
and the man who ran the ring toss said he'd seen worse; he packed the bottles in hay and drove
south with the radio up, past the grain elevator and the church with the new sign out front.`;

const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe('chop', () => {
  const scraps = chop(TEXT, 'page:1:chop:0');
  it('makes scraps of 2 to 5 words', () => {
    for (const s of scraps) {
      expect(words(s).length).toBeGreaterThanOrEqual(2);
      expect(words(s).length).toBeLessThanOrEqual(5);
    }
  });
  it('keeps every word, in order', () => {
    const strip = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
    expect(strip(scraps.join(' '))).toEqual(strip(TEXT));
  });
  it('breaks at punctuation first', () => {
    expect(scraps.some((s) => s.endsWith('wind'))).toBe(true);
    expect(scraps.some((s) => s.endsWith("seen worse"))).toBe(true);
  });
  it('is the same for the same text and seed, different for another seed', () => {
    expect(chop(TEXT, 'page:1:chop:0')).toEqual(scraps);
    expect(chop(TEXT, 'page:1:chop:1')).not.toEqual(scraps);
  });
  it('rechops a text made only of short clauses', () => {
    const t = 'The water tower peeled in strips, and the mayor said nothing at all. We painted our names anyway.';
    const seen = new Set(Array.from({ length: 10 }, (_, i) => chop(t, `s${i}`).join('/')));
    expect(seen.size).toBeGreaterThan(1);
  });
  it('handles short and empty texts', () => {
    expect(chop('', 's')).toEqual([]);
    expect(chop('one', 's')).toEqual(['one']);
    const short = chop('Hello. See you now', 's');
    expect(short.join(' ').replace(/[^a-z ]/gi, '')).toBe('Hello See you now');
    for (const x of short) expect(words(x).length).toBeGreaterThanOrEqual(2);
  });
});
