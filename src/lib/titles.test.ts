import { describe, expect, it } from 'vitest';
import { detect, detectWord } from './detect';
import { formsOf } from './forms';
import { chorusLines, titleInChorus, titleWords } from './titles';

describe('titleWords', () => {
  it('drops stopwords, possessives and duplicates', () => {
    expect(titleWords('Quarter in My Shoe')).toEqual(['quarter', 'shoe']);
    expect(titleWords("Grandpa's Pocketknife")).toEqual(['grandpa', 'pocketknife']);
    expect(titleWords('The Dog Knows Better')).toEqual(['dog', 'knows', 'better']);
    expect(titleWords('Hand-Me-Down Boots')).toEqual(['hand-me-down', 'boots']);
  });
  it('keeps a one-word title even if it is a stopword', () => {
    expect(titleWords('Overtime')).toEqual(['overtime']);
  });
});

describe('chorusLines', () => {
  const body = ['[Chorus]', 'a', 'b', '[Verse 2]', 'c', '[Final chorus]', 'd', '', 'e'].join('\n');
  it('collects lines under any label with "chorus" until the next label', () => {
    expect([...chorusLines(body)]).toEqual([1, 2, 6, 7, 8]);
  });
  it('is empty without a chorus label', () => {
    expect(chorusLines('just\nlines').size).toBe(0);
  });
});

describe('titleInChorus', () => {
  const words = ['quarter', 'shoe'].map((w) => detectWord(w, formsOf(w)));
  it('needs every title word in chorus lines', () => {
    const outside = 'A quarter in my shoe\n[Chorus]\nnothing here';
    const r1 = detect(outside, words, 'root', {});
    expect(titleInChorus(r1, chorusLines(outside))).toBe(false);
    const inside = '[Chorus]\nTwo quarters in these shoes';
    const r2 = detect(inside, words, 'root', {});
    expect(titleInChorus(r2, chorusLines(inside))).toBe(true);
  });
  it('is false with no words', () => {
    expect(titleInChorus([], new Set([1]))).toBe(false);
  });
});
