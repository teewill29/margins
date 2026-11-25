// docs/DETECTION.md section 8, syllables.
import { describe, expect, it } from 'vitest';
import { countLine, numberToWords } from './syllables';

describe('countLine', () => {
  const cases: [string, number | null][] = [
    ['Headlights crawl across the porch', 7],
    ['I burned your static for the heat', 8],
    ['Rust on the ladder rungs', 6],
    ['A quarter I borrowed from you', 8],
    ['I swallowed the envelope whole', 8],
    ['Tide comes in like', 4],
    ['Born in 1999', 7],
    ["The fire's out", 3],
    ['[Chorus]', null],
    ['', null],
    ['   ', null],
  ];
  for (const [line, n] of cases) it(JSON.stringify(line), () => expect(countLine(line)).toBe(n));

  it('counts each part of a hyphenated word', () => {
    expect(countLine('burnt-out')).toBe(2);
  });
  it('uses the override table', () => {
    expect(countLine('every hour')).toBe(3);
  });
});

describe('numberToWords', () => {
  it('reads numbers the way they are sung', () => {
    expect(numberToWords(7)).toBe('seven');
    expect(numberToWords(42)).toBe('forty-two');
    expect(numberToWords(1999)).toBe('nineteen ninety-nine');
    expect(numberToWords(1905)).toBe('nineteen oh five');
    expect(numberToWords(2005)).toBe('two thousand five');
    expect(numberToWords(1800)).toBe('eighteen hundred');
    expect(numberToWords(300)).toBe('three hundred');
    expect(numberToWords(9999)).toBe('ninety-nine ninety-nine');
  });
  it('counts big numbers digit by digit', () => {
    expect(countLine('12345')).toBe(1 + 1 + 1 + 1 + 1); // one two three four five
  });
});
