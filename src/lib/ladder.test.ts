import { describe, expect, it } from 'vitest';
import { drawLadder, LADDER_SIZE, LADDER_THEMED, RECIPE, shuffleColumn, WORLDS, type Pos, type Stats, type WordEntry } from './draw';
import { pairPhrase, thirdPerson } from './ladder';

function makeBank(per = 20): WordEntry[] {
  const out: WordEntry[] = [];
  let n = 0;
  for (const pos of RECIPE.map((r) => r.pos) as Pos[]) {
    for (const world of [...WORLDS, null]) {
      for (let i = 0; i < per; i++) {
        const w = `${pos}${world ?? 'any'}${i}`;
        n++;
        out.push({ w, pos, conc: pos === 'abstract' ? 1 : 5, common: 4, syl: 2, worlds: world ? [world] : [], rhyme: `R${n % 300}`, forms: [`${w}s`] });
      }
    }
  }
  return out;
}
const BANK = makeBank();
const byW = new Map(BANK.map((e) => [e.w, e]));

describe('drawLadder', () => {
  const l = drawLadder({ seed: 'page:1', bank: BANK });
  it('has 8 nouns and 8 verbs, 16 unique words', () => {
    expect(l.nouns).toHaveLength(LADDER_SIZE);
    expect(l.verbs).toHaveLength(LADDER_SIZE);
    expect(l.nouns.every((w) => byW.get(w)?.pos === 'noun')).toBe(true);
    expect(l.verbs.every((w) => byW.get(w)?.pos === 'verb')).toBe(true);
    expect(new Set([...l.nouns, ...l.verbs]).size).toBe(16);
  });
  it('pulls at least 6 per column from one world', () => {
    for (let i = 0; i < 30; i++) {
      const g = drawLadder({ seed: `w${i}`, bank: BANK });
      for (const col of [g.nouns, g.verbs]) expect(col.filter((w) => byW.get(w)?.worlds.includes(g.world)).length).toBeGreaterThanOrEqual(LADDER_THEMED);
    }
  });
  it('never repeats a rhyme key across both columns', () => {
    for (let i = 0; i < 50; i++) {
      const g = drawLadder({ seed: `r${i}`, bank: BANK });
      const keys = [...g.nouns, ...g.verbs].map((w) => byW.get(w)?.rhyme);
      expect(new Set(keys).size).toBe(16);
    }
  });
  it('is deterministic per seed', () => {
    expect(drawLadder({ seed: 'page:1', bank: BANK })).toEqual(l);
    expect(drawLadder({ seed: 'page:2', bank: BANK })).not.toEqual(l);
  });
  it('never draws a banned word', () => {
    const stats: Stats = new Map([[l.nouns[0] as string, { banned: true }]]);
    for (let i = 0; i < 300; i++) expect(drawLadder({ seed: `b${i}`, bank: BANK, stats }).nouns).not.toContain(l.nouns[0]);
  });
  it('shuffles one column, keeping the world and the other column', () => {
    const nouns = shuffleColumn({ seedBase: 'page:1', column: 'nouns', n: 1, ladder: l, bank: BANK });
    expect(nouns).toHaveLength(LADDER_SIZE);
    expect(nouns.some((w) => l.nouns.includes(w))).toBe(false);
    expect(nouns.filter((w) => byW.get(w)?.worlds.includes(l.world)).length).toBeGreaterThanOrEqual(LADDER_THEMED);
    expect(nouns.some((w) => l.verbs.includes(w))).toBe(false);
    expect(shuffleColumn({ seedBase: 'page:1', column: 'nouns', n: 1, ladder: l, bank: BANK })).toEqual(nouns);
  });
});

describe('pairs', () => {
  it('conjugates for he/she/it', () => {
    expect(thirdPerson('confess')).toBe('confesses');
    expect(thirdPerson('bury')).toBe('buries');
    expect(thirdPerson('idle')).toBe('idles');
    expect(thirdPerson('swallow')).toBe('swallows');
    expect(thirdPerson('go')).toBe('goes');
    expect(thirdPerson('play')).toBe('plays');
  });
  it('builds the phrase, plural nouns take the base verb', () => {
    expect(pairPhrase('porch', ['porches'], 'confess')).toBe('the porch confesses');
    expect(pairPhrase('headlights', ['headlight'], 'confess')).toBe('the headlights confess');
    expect(pairPhrase('glass', ['glasses'], 'rattle')).toBe('the glass rattles');
  });
});
