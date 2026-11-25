import { describe, expect, it } from 'vitest';
import { lastUsed, type ExerciseType } from './exercises';
import { pickSurprise, surpriseWeight } from './surprise';

describe('surpriseWeight', () => {
  it('is days since last used + 1, capped at 30; never used is 30', () => {
    expect(surpriseWeight('2026-11-25', '2026-11-25')).toBe(1);
    expect(surpriseWeight('2026-11-15', '2026-11-25')).toBe(11);
    expect(surpriseWeight('2026-01-01', '2026-11-25')).toBe(30);
    expect(surpriseWeight(undefined, '2026-11-25')).toBe(30);
  });
});

describe('pickSurprise', () => {
  it('favors the least recently used, by weight', () => {
    const types: ExerciseType[] = ['grid', 'object'];
    const last = new Map<ExerciseType, string>([['grid', '2026-11-25']]); // grid weight 1, object 30
    let grid = 0;
    for (let i = 0; i < 3100; i++) if (pickSurprise(types, last, '2026-11-25', `s${i}`) === 'grid') grid++;
    expect(grid / 3100).toBeGreaterThan(0.02);
    expect(grid / 3100).toBeLessThan(0.05); // expected 1/31
  });
});

describe('lastUsed', () => {
  it('keeps the latest date per exercise', () => {
    const m = lastUsed([
      { exercise: 'grid', date: '2026-11-01' },
      { exercise: 'grid', date: '2026-11-20' },
      { exercise: 'title', date: '2026-10-30' },
    ]);
    expect(m.get('grid')).toBe('2026-11-20');
    expect(m.get('title')).toBe('2026-10-30');
    expect(m.has('dice')).toBe(false);
  });
});
