// Every test in docs/WORDS.md section 4, plus random.ts basics.
import { describe, expect, it } from 'vitest';
import { dailySeed, drawDaily, drawGrid, MAX_SWAPS, RECIPE, shuffleGrid, swapInGrid, WORLDS, type Pos, type Stats, type WordEntry } from './draw';
import { hashString, mulberry32 } from './random';

/** A synthetic bank: `per` words of each pos in every world, plus unthemed ones. */
function makeBank({ per = 20, rhymes = 0, extra = [] as WordEntry[] } = {}): WordEntry[] {
  const out: WordEntry[] = [];
  const conc: Record<Pos, 1 | 2 | 3 | 4 | 5> = { noun: 5, verb: 4, texture: 4, place: 5, abstract: 1 };
  let n = 0;
  for (const pos of RECIPE.map((r) => r.pos)) {
    for (const world of [...WORLDS, null]) {
      const count = pos === 'noun' ? per * 2 : per;
      for (let i = 0; i < count; i++) {
        const w = `${pos}${world ?? 'any'}${i}`;
        n++;
        out.push({ w, pos, conc: conc[pos], common: 4, syl: 2, worlds: world ? [world] : [], rhyme: rhymes ? `R${n % rhymes}` : `R${n}`, forms: [`${w}s`] });
      }
    }
  }
  return [...out, ...extra];
}

const BANK = makeBank();
const byW = new Map(BANK.map((e) => [e.w, e]));
const entry = (w: string, bank = byW) => bank.get(w) as WordEntry;

describe('random', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(hashString('x'));
    const b = mulberry32(hashString('x'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(hashString('y'))()).not.toBe(mulberry32(hashString('x'))());
  });
});

describe('drawGrid', () => {
  const grid = drawGrid({ seed: 'page:1', difficulty: 'medium', bank: BANK });

  it('1. has exactly 16 unique words', () => {
    expect(grid.words).toHaveLength(16);
    expect(new Set(grid.words).size).toBe(16);
  });

  it('2. matches the recipe: 8 noun, 4 verb, 2 texture, 1 place, 1 abstract', () => {
    const counts: Record<string, number> = {};
    for (const w of grid.words) counts[entry(w).pos] = (counts[entry(w).pos] ?? 0) + 1;
    expect(counts).toEqual({ noun: 8, verb: 4, texture: 2, place: 1, abstract: 1 });
  });

  it('3. has at most one word with conc <= 2', () => {
    for (let i = 0; i < 50; i++) {
      const g = drawGrid({ seed: `c${i}`, difficulty: 'wild', bank: BANK });
      expect(g.words.filter((w) => entry(w).conc <= 2).length).toBeLessThanOrEqual(1);
    }
  });

  it('4. never repeats a rhyme key', () => {
    const bank = makeBank({ rhymes: 40 });
    const m = new Map(bank.map((e) => [e.w, e]));
    for (let i = 0; i < 100; i++) {
      const g = drawGrid({ seed: `r${i}`, difficulty: 'medium', bank });
      const keys = g.words.map((w) => entry(w, m).rhyme);
      expect(new Set(keys).size).toBe(16);
    }
  });

  it('5. never has two words that share a root', () => {
    const burn: WordEntry = { w: 'burn', pos: 'verb', conc: 4, common: 5, syl: 1, worlds: ['road'], rhyme: 'ER N', forms: ['burned', 'burnt', 'burning', 'burns'] };
    const burnt: WordEntry = { w: 'burnt', pos: 'verb', conc: 4, common: 5, syl: 1, worlds: ['road'], rhyme: 'ER N T', forms: ['burnts'] };
    // Only these two verbs in road, and nothing else: a root clash would be forced without the rule.
    const bank = makeBank({ per: 3 }).filter((e) => !(e.pos === 'verb')).concat([burn, burnt], makeBank({ per: 3 }).filter((e) => e.pos === 'verb' && e.worlds.length === 0));
    for (let i = 0; i < 300; i++) {
      const g = drawGrid({ seed: `root${i}`, difficulty: 'loose', bank });
      expect(g.words.includes('burn') && g.words.includes('burnt')).toBe(false);
    }
  });

  it('6. pulls the right number of words from the chosen world', () => {
    for (const [difficulty, min] of [['loose', 12], ['medium', 10], ['wild', 4]] as const) {
      for (let i = 0; i < 30; i++) {
        const g = drawGrid({ seed: `w${difficulty}${i}`, difficulty, bank: BANK });
        expect(g.words.filter((w) => entry(w).worlds.includes(g.world)).length).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('7. same seed gives the same grid in the same order; another seed differs', () => {
    expect(drawGrid({ seed: 'page:1', difficulty: 'medium', bank: BANK })).toEqual(grid);
    expect(drawGrid({ seed: 'page:2', difficulty: 'medium', bank: BANK }).words).not.toEqual(grid.words);
  });

  it('8. never draws a banned word in 1,000 draws', () => {
    const target = grid.words[0] as string;
    const stats: Stats = new Map([[target, { banned: true }]]);
    for (let i = 0; i < 1000; i++) expect(drawGrid({ seed: `b${i}`, difficulty: 'loose', bank: BANK, stats }).words).not.toContain(target);
  });

  it('9. locked words survive Shuffle in the same cells', () => {
    const state = { seedBase: 'page:1', shuffles: 0, words: grid.words, locked: [grid.words[3] as string, grid.words[11] as string], difficulty: 'medium' as const };
    let cur = state;
    for (let i = 0; i < 5; i++) {
      const next = shuffleGrid({ ...cur, bank: BANK });
      expect(next.words[3]).toBe(grid.words[3]);
      expect(next.words[11]).toBe(grid.words[11]);
      expect(next.words).not.toEqual(cur.words);
      expect(next.shuffles).toBe(cur.shuffles + 1);
      cur = { ...cur, words: next.words, shuffles: next.shuffles };
    }
  });

  it('10. refuses a 4th swap', () => {
    let state = { words: grid.words, world: grid.world, swapsUsed: 0 };
    for (let i = 0; i < MAX_SWAPS; i++) {
      const next = swapInGrid({ ...state, seedBase: 'page:1', cell: i, bank: BANK });
      expect(next).not.toBeNull();
      expect(next?.words[i]).not.toBe(state.words[i]);
      expect(entry(next?.words[i] as string).pos).toBe(entry(state.words[i] as string).pos);
      state = { ...state, words: next?.words ?? [], swapsUsed: next?.swapsUsed ?? 0 };
    }
    expect(swapInGrid({ ...state, seedBase: 'page:1', cell: 5, bank: BANK })).toBeNull();
  });

  it('11. a word with 3 swaps is drawn about 1/8 as often', () => {
    const base = makeBank({ per: 20 }).filter((e) => e.pos !== 'abstract');
    const a: WordEntry = { w: 'mercy', pos: 'abstract', conc: 1, common: 4, syl: 2, worlds: [], rhyme: 'A', forms: [] };
    const b: WordEntry = { w: 'rumor', pos: 'abstract', conc: 1, common: 4, syl: 2, worlds: [], rhyme: 'B', forms: [] };
    const bank = [...base, a, b];
    const stats: Stats = new Map([['rumor', { swaps: 3 }]]);
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 10_000; i++) {
      const g = drawGrid({ seed: `s${i}`, difficulty: 'wild', bank, stats });
      if (g.words.includes('mercy')) na++;
      if (g.words.includes('rumor')) nb++;
    }
    expect(nb / na).toBeGreaterThan((1 / 8) * 0.75);
    expect(nb / na).toBeLessThan((1 / 8) * 1.25);
  }, 60_000);

  it('12. the daily grid ignores bans and favorites', () => {
    const date = '2026-11-24';
    expect(dailySeed(date)).toBe('margins-daily-2026-11-24');
    const plain = drawDaily(date, BANK);
    const w0 = plain.words[0] as string;
    const stats1: Stats = new Map([[w0, { banned: true }]]);
    const stats2: Stats = new Map([[w0, { favorite: true, swaps: 2 }]]);
    expect(drawDaily(date, BANK, stats1)).toEqual(plain);
    expect(drawDaily(date, BANK, stats2)).toEqual(plain);
    expect(plain).toEqual(drawGrid({ seed: dailySeed(date), difficulty: 'medium', bank: BANK }));
  });

  it('13. a tiny world still fills all 16 slots', () => {
    const tiny = makeBank({ per: 10 }).filter((e) => !e.worlds.includes('motel'));
    tiny.push(
      { w: 'icebucket', pos: 'noun', conc: 5, common: 4, syl: 3, worlds: ['motel'], rhyme: 'X1', forms: [] },
      { w: 'keycard', pos: 'noun', conc: 5, common: 4, syl: 2, worlds: ['motel'], rhyme: 'X2', forms: [] },
    );
    const m = new Map(tiny.map((e) => [e.w, e]));
    for (let i = 0; i < 200; i++) {
      const g = drawGrid({ seed: `t${i}`, difficulty: 'loose', bank: tiny });
      expect(new Set(g.words).size).toBe(16);
      if (g.world === 'motel') expect(g.words.filter((w) => entry(w, m).worlds.includes('motel')).length).toBeLessThanOrEqual(2);
    }
  });
});
