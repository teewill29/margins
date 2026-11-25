import { describe, expect, it } from 'vitest';
import { isLabelLine, labelText, lineAt, previewLines } from './pad';

describe('section labels', () => {
  it('recognises bracketed lines', () => {
    expect(isLabelLine('[Verse 1]')).toBe(true);
    expect(isLabelLine('  [Chorus]  ')).toBe(true);
    expect(labelText('[ Bridge ]')).toBe('Bridge');
  });
  it('ignores lines with other text or empty brackets', () => {
    expect(isLabelLine('[Chorus] again')).toBe(false);
    expect(isLabelLine('I said [quietly]')).toBe(false);
    expect(isLabelLine('[]')).toBe(false);
    expect(labelText('plain')).toBeNull();
  });
});

describe('lineAt', () => {
  const body = 'one\ntwo\n\nfour';
  it('finds the line of an offset', () => {
    expect(lineAt(body, 0)).toBe(0);
    expect(lineAt(body, 3)).toBe(0); // end of "one"
    expect(lineAt(body, 4)).toBe(1);
    expect(lineAt(body, 8)).toBe(2);
    expect(lineAt(body, body.length)).toBe(3);
  });
});

describe('previewLines', () => {
  it('skips blank lines and labels', () => {
    expect(previewLines('[Verse 1]\n\n  Headlights crawl  \n[Chorus]\nI burned it\nthird')).toEqual([
      'Headlights crawl',
      'I burned it',
    ]);
  });
  it('returns what it finds', () => {
    expect(previewLines('[Verse]\n')).toEqual([]);
    expect(previewLines('only one')).toEqual(['only one']);
  });
});
