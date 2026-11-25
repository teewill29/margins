// Every case in docs/DETECTION.md section 8.
import { describe, expect, it } from 'vitest';
import { detect, detectWord, normalizeToken, tokenize, type Level } from './detect';
import { formsOf } from './forms';

const T = true;
const F = false;
// word, token, Exact, Root, Loose
const MATCHING: [string, string, boolean, boolean, boolean][] = [
  ['burn', 'burn', T, T, T],
  ['burn', 'Burned,', F, T, T],
  ['burn', 'burnt', F, T, T],
  ['burn', 'burning', F, T, T],
  ['burn', 'burns', F, T, T],
  ['burn', 'burner', F, F, T],
  ['burn', 'burnt-out', F, T, T],
  ['run', 'ran', F, T, T],
  ['run', "runnin'", F, T, T],
  ['swallow', 'swallowed', F, T, T],
  ['borrow', 'borrowed', F, T, T],
  ['porch', 'porches', F, T, T],
  ['porch', "porch's", T, T, T],
  ['porch', 'porchlight', F, F, T],
  ['headlights', 'headlight', F, T, T],
  ['rust', 'rusty', F, F, T],
  ['rust', 'trust', F, F, F],
  ['art', 'start', F, F, F],
  ['tide', 'tidy', F, F, F],
  ['stop', 'stopped', F, T, T],
  ['hope', 'hoping', F, T, T],
  ['bury', 'buried', F, T, T],
  ['knife', 'knives', F, T, T],
  ['envelope', 'envelop', F, F, T],
  ['cathedral', 'Cathedrals.', F, T, T],
];

const used = (word: string, text: string, level: Level) => detect(text, [detectWord(word, formsOf(word))], level, {})[0]?.used;

describe('matching table', () => {
  for (const [word, token, exact, root, loose] of MATCHING) {
    it(`${word} / ${token}`, () => {
      const text = `I said ${token} again`;
      expect(used(word, text, 'exact'), 'Exact').toBe(exact);
      expect(used(word, text, 'root'), 'Root').toBe(root);
      expect(used(word, text, 'loose'), 'Loose').toBe(loose);
    });
  }
  it("curly apostrophes and dropped g's", () => {
    expect(used('run', 'runnin’ late', 'root')).toBe(true);
    expect(used('porch', 'the porch’s light', 'exact')).toBe(true);
  });
});

describe('overrides', () => {
  const burn = [detectWord('burn', formsOf('burn'))];
  it('used with no match', () => {
    const r = detect('nothing here', [detectWord('mercy', formsOf('mercy'))], 'root', { mercy: 'used' })[0];
    expect(r).toMatchObject({ used: true, source: 'override' });
  });
  it('unused hides matches', () => {
    const r = detect('I burned it', burn, 'root', { burn: 'unused' })[0];
    expect(r?.used).toBe(false);
    expect(r?.matches).toEqual([]);
  });
  it('auto at Exact does not count a changed form', () => {
    expect(detect('I burned it', burn, 'exact', { burn: 'auto' })[0]?.used).toBe(false);
  });
});

describe('match details', () => {
  it('reports line, offsets of the word without punctuation, and exactness', () => {
    const r = detect('[Verse]\nI Burned, it\nburn', [detectWord('burn', formsOf('burn'))], 'root', {})[0];
    expect(r?.source).toBe('match');
    expect(r?.matches).toEqual([
      { line: 1, start: 2, end: 8, token: 'burned', exact: false },
      { line: 2, start: 0, end: 4, token: 'burn', exact: true },
    ]);
  });
  it('highlights a whole hyphenated token', () => {
    const r = detect('a burnt-out bulb', [detectWord('burn', formsOf('burn'))], 'root', {})[0];
    expect(r?.matches[0]).toMatchObject({ start: 2, end: 11, token: 'burnt-out' });
  });
  it('skips section labels', () => {
    expect(used('chorus', '[Chorus]', 'root')).toBe(false);
  });
});

describe('normalizing and tokenizing', () => {
  it('normalizes per DETECTION.md section 1', () => {
    expect(normalizeToken('“Lovin’,”').norm).toBe('loving');
    expect(normalizeToken("porch's").norm).toBe('porch');
    expect(normalizeToken('(Headlights)').norm).toBe('headlights');
    expect(normalizeToken("don't").norm).toBe("don't");
  });
  it('keeps line and character positions', () => {
    const toks = tokenize('one two\n  three');
    expect(toks.map((t) => [t.line, t.start, t.end, t.norm])).toEqual([
      [0, 0, 3, 'one'],
      [0, 4, 7, 'two'],
      [1, 2, 7, 'three'],
    ]);
  });
});

describe('performance', () => {
  it('handles a 2,000-word page quickly', () => {
    const words = ['porch', 'gasoline', 'quarter', 'ankle', 'rust', 'borrow', 'ladder', 'static', 'cathedral', 'swallow', 'headlights', 'burn', 'envelope', 'tide', 'mercy', 'shovel'].map((w) =>
      detectWord(w, formsOf(w)),
    );
    const line = 'Headlights crawl across the porch, I burned your static for the heat and borrowed rusty quarters\n';
    const text = line.repeat(125); // 2,000 words
    detect(text, words, 'loose', {});
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) detect(text, words, 'loose', {});
    expect((performance.now() - t0) / 5).toBeLessThan(10);
  });
});
