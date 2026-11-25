import { describe, expect, it } from 'vitest';
import { resolvePin } from './pins';

const song = ['[Verse 1]', 'Headlights crawl across the porch', 'I burned your static', 'Rust on the ladder'];

describe('resolvePin', () => {
  it('stays put when nothing moved', () => {
    expect(resolvePin(song, 2, 'I burned your static')).toEqual({ line: 2, text: 'I burned your static' });
  });
  it('follows its line when lines are added above', () => {
    const moved = ['New first line', '', ...song];
    expect(resolvePin(moved, 2, 'I burned your static')).toEqual({ line: 4, text: 'I burned your static' });
  });
  it('follows its line when it is moved below others', () => {
    const moved = ['[Verse 1]', 'Rust on the ladder', 'Headlights crawl across the porch', 'I burned your static'];
    expect(resolvePin(moved, 2, 'I burned your static')?.line).toBe(3);
  });
  it('follows its line when lines above are deleted', () => {
    expect(resolvePin(song.slice(2), 2, 'I burned your static')?.line).toBe(0);
  });
  it('ignores surrounding spaces', () => {
    expect(resolvePin(['a', '  I burned your static '], 0, 'I burned your static')?.line).toBe(1);
  });
  it('keeps the index and takes the new text when the line itself is edited', () => {
    const edited = [...song];
    edited[2] = 'I burned your static for the heat';
    expect(resolvePin(edited, 2, 'I burned your static')).toEqual({ line: 2, text: 'I burned your static for the heat' });
  });
  it('picks the nearest copy of a repeated line', () => {
    const chorus = ['Hold the door', 'x', 'y', 'z', 'Hold the door'];
    expect(resolvePin(chorus, 4, 'Hold the door')?.line).toBe(4);
    expect(resolvePin(chorus, 1, 'Hold the door')?.line).toBe(0);
  });
  it('keeps a pin on a blank line by index', () => {
    expect(resolvePin(['a', '', 'b', ''], 3, '')?.line).toBe(3);
  });
  it('unpins when the line is gone and the text is nowhere', () => {
    expect(resolvePin(['only line'], 5, 'gone')).toBeNull();
  });
  it('returns null for an unpinned memo', () => {
    expect(resolvePin(song, null, null)).toBeNull();
  });
});
