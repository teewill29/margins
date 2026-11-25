import { describe, expect, it } from 'vitest';
import { AGE_MAX, AGE_MIN, renderCharacter, rollCharacter } from './character';

const tables = {
  names: ['Dale', 'Marisol', 'June'],
  jobs: ['works overnights at a toll booth', 'repossesses boats'],
  wants: ['wants the phone to ring', 'wants one more good season'],
  obstacles: ['keeps missing the call', 'the truck won\'t start'],
};

describe('character', () => {
  it('renders the SPEC sentence', () => {
    expect(renderCharacter({ name: 'Dale', age: 58, job: 'works overnights at a toll booth', want: 'wants the phone to ring', obstacle: 'keeps missing the call' })).toBe(
      'Dale, 58, works overnights at a toll booth. Wants the phone to ring. Keeps missing the call.',
    );
  });
  it('is deterministic per seed', () => {
    expect(rollCharacter(tables, 'page:1:character:1')).toEqual(rollCharacter(tables, 'page:1:character:1'));
  });
  it('keeps ages between 16 and 85', () => {
    for (let i = 0; i < 500; i++) {
      const { age } = rollCharacter(tables, `s${i}`);
      expect(age).toBeGreaterThanOrEqual(AGE_MIN);
      expect(age).toBeLessThanOrEqual(AGE_MAX);
    }
  });
  it('rerolls one part and leaves the rest', () => {
    const c = rollCharacter(tables, 'a');
    for (let i = 0; i < 20; i++) {
      const next = rollCharacter(tables, `b${i}`, c, ['job']);
      expect(next.job).not.toBe(c.job);
      expect({ ...next, job: c.job }).toEqual(c);
    }
  });
  it('never rerolls the same age', () => {
    const c = rollCharacter(tables, 'a');
    for (let i = 0; i < 200; i++) expect(rollCharacter(tables, `c${i}`, c, ['age']).age).not.toBe(c.age);
  });
});
