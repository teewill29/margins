// Character exercise (WORDS.md section 6): tables, seeded rolls, and the rendered sentence.
import { pickIndex } from './pick';
import { randomInt, rngFor } from './random';

export type CharacterPart = 'name' | 'age' | 'job' | 'want' | 'obstacle';
export const PARTS: readonly CharacterPart[] = ['name', 'age', 'job', 'want', 'obstacle'];
export const AGE_MIN = 16;
export const AGE_MAX = 85;

export interface Character {
  name: string;
  age: number;
  job: string;
  want: string;
  obstacle: string;
}

interface Tables {
  names: readonly string[];
  jobs: readonly string[];
  wants: readonly string[];
  obstacles: readonly string[];
}

const TABLE: Record<Exclude<CharacterPart, 'age'>, keyof Tables> = { name: 'names', job: 'jobs', want: 'wants', obstacle: 'obstacles' };

/** Rolls the named parts (all by default) with `seed`, never repeating the current value. */
export function rollCharacter(tables: Tables, seed: string, current?: Partial<Character>, which: readonly CharacterPart[] = PARTS): Character {
  const out: Character = { name: '', age: AGE_MIN, job: '', want: '', obstacle: '', ...current };
  for (const part of which) {
    if (part === 'age') {
      const rng = rngFor(`${seed}:age`);
      let age = AGE_MIN + randomInt(rng, AGE_MAX - AGE_MIN + 1);
      if (age === current?.age) age = age === AGE_MAX ? AGE_MIN : age + 1;
      out.age = age;
    } else {
      const list = tables[TABLE[part]];
      const cur = list.indexOf(current?.[part] ?? '');
      out[part] = list[pickIndex(`${seed}:${part}`, list.length, new Set(cur >= 0 ? [cur] : []))] ?? '';
    }
  }
  return out;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Dale, 58, works overnights at a toll booth. Wants the phone to ring. Keeps missing the call." */
export function renderCharacter(c: Character): string {
  return `${c.name}, ${c.age}, ${c.job}. ${capitalize(c.want)}. ${capitalize(c.obstacle)}.`;
}
