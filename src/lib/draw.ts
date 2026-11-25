// Word grid draw (WORDS.md section 4). Pure: no React, no database.
import { pickWeighted, rngFor, shuffled, type Rng } from './random';

export type Pos = 'noun' | 'verb' | 'texture' | 'place' | 'abstract';
export type Difficulty = 'loose' | 'medium' | 'wild';

export interface WordEntry {
  w: string;
  pos: Pos;
  conc: 1 | 2 | 3 | 4 | 5;
  common: 1 | 2 | 3 | 4 | 5;
  syl: number;
  worlds: string[];
  rhyme: string;
  /** Every other form of the word (formsOf, computed by `npm run bank`). */
  forms: string[];
}

export interface StatLike {
  swaps?: number;
  banned?: boolean;
  favorite?: boolean;
}
export type Stats = ReadonlyMap<string, StatLike>;

export const WORLDS = [
  'road', 'kitchen', 'church', 'small-town', 'weather', 'body', 'night', 'coast', 'winter',
  'school', 'job-site', 'bar', 'bedroom', 'garage', 'farm', 'city', 'motel', 'hospital',
] as const;

interface SlotRule {
  pos: Pos;
  count: number;
  conc: (c: number) => boolean;
  common: number;
}

/** The 16-word recipe. Order here is also the fill order (WORDS.md step 5). */
export const RECIPE: readonly SlotRule[] = [
  { pos: 'abstract', count: 1, conc: (c) => c <= 2, common: 3 },
  { pos: 'place', count: 1, conc: (c) => c >= 4, common: 2 },
  { pos: 'texture', count: 2, conc: (c) => c >= 3, common: 2 },
  { pos: 'verb', count: 4, conc: (c) => c >= 3, common: 3 },
  { pos: 'noun', count: 8, conc: (c) => c >= 4, common: 3 },
];

export const THEMED: Readonly<Record<Difficulty, number>> = { loose: 12, medium: 10, wild: 4 };
export const MAX_SWAPS = 3;
export const GRID_SIZE = 16;

export function dailySeed(date: string): string {
  return `margins-daily-${date}`;
}

export function weightOf(s: StatLike | undefined): number {
  return Math.max(0.1, 0.5 ** (s?.swaps ?? 0)) * (s?.favorite ? 2 : 1);
}

/** Words chosen so far, with everything needed to test a new candidate. */
class Picked {
  readonly words = new Set<string>();
  readonly forms = new Set<string>();
  readonly rhymes = new Set<string>();
  add(e: WordEntry) {
    this.words.add(e.w);
    this.forms.add(e.w);
    e.forms.forEach((f) => this.forms.add(f));
    this.rhymes.add(e.rhyme);
  }
  sharesRoot(e: WordEntry) {
    return this.forms.has(e.w) || e.forms.some((f) => this.words.has(f));
  }
}

interface Slot {
  pos: Pos;
  themed: boolean;
}

interface BankIndex {
  byW: Map<string, WordEntry>;
  /** Words of each pos, and those that also meet the slot's conc and common rules. */
  all: Map<Pos, WordEntry[]>;
  eligible: Map<Pos, WordEntry[]>;
}
const indexCache = new WeakMap<readonly WordEntry[], BankIndex>();

function indexOf(bank: readonly WordEntry[]): BankIndex {
  let idx = indexCache.get(bank);
  if (!idx) {
    const all = new Map<Pos, WordEntry[]>(RECIPE.map((r) => [r.pos, bank.filter((e) => e.pos === r.pos)]));
    const eligible = new Map<Pos, WordEntry[]>(
      RECIPE.map((r) => [r.pos, (all.get(r.pos) ?? []).filter((e) => r.conc(e.conc) && e.common >= r.common)]),
    );
    idx = { byW: new Map(bank.map((e) => [e.w, e])), all, eligible };
    indexCache.set(bank, idx);
  }
  return idx;
}

/** One word for a slot, with the WORDS.md fallbacks: drop the world, then the rhyme rule. */
function fillSlot(slot: Slot, world: string, bank: readonly WordEntry[], picked: Picked, stats: Stats | undefined, rng: Rng): WordEntry {
  const idx = indexOf(bank);
  const base = (idx.eligible.get(slot.pos) ?? []).filter(
    (e) =>
      !stats?.get(e.w)?.banned &&
      !picked.words.has(e.w) &&
      !picked.sharesRoot(e),
  );
  const noRhyme = base.filter((e) => !picked.rhymes.has(e.rhyme));
  const tries = [
    slot.themed ? noRhyme.filter((e) => e.worlds.includes(world)) : [],
    noRhyme,
    base,
    // Last resort for tiny banks: any unbanned word of this pos not already in the grid.
    (idx.all.get(slot.pos) ?? []).filter((e) => !stats?.get(e.w)?.banned && !picked.words.has(e.w)),
  ];
  const pool = tries.find((t) => t.length > 0);
  if (!pool) throw new Error(`The word bank has no ${slot.pos} left to draw.`);
  return pickWeighted(pool, (e) => (stats ? weightOf(stats.get(e.w)) : 1), rng);
}

export interface DrawGridInput {
  seed: string;
  difficulty: Difficulty;
  bank: readonly WordEntry[];
  /** Locked words and the cells they keep. */
  locked?: readonly { cell: number; w: string }[];
  stats?: Stats;
}

export interface Grid {
  world: string;
  /** 16 words in display order. */
  words: string[];
}

export function drawGrid({ seed, difficulty, bank, locked = [], stats }: DrawGridInput): Grid {
  const rng = rngFor(seed);
  const { byW } = indexOf(bank);
  const world = WORLDS[Math.floor(rng() * WORLDS.length)] as string;

  // Slots from the recipe; locked words fill slots of their own pos first.
  const open = new Map<Pos, number>(RECIPE.map((r) => [r.pos, r.count]));
  const picked = new Picked();
  let lockedInWorld = 0;
  for (const l of locked) {
    const e = byW.get(l.w) ?? ({ w: l.w, pos: 'noun', conc: 5, common: 4, syl: 1, worlds: [], rhyme: `~${l.w}`, forms: [] } as WordEntry);
    const pos = [e.pos, 'noun', 'verb', ...RECIPE.map((r) => r.pos)].find((p) => (open.get(p as Pos) ?? 0) > 0) as Pos | undefined;
    if (pos) open.set(pos, (open.get(pos) ?? 0) - 1);
    picked.add(e);
    if (e.worlds.includes(world)) lockedInWorld++;
  }

  const slots: Slot[] = [];
  for (const r of RECIPE) for (let i = 0; i < (open.get(r.pos) ?? 0); i++) slots.push({ pos: r.pos, themed: false });
  const themedCount = Math.max(0, THEMED[difficulty] - lockedInWorld);
  shuffled(slots, rng).slice(0, themedCount).forEach((s) => (s.themed = true));

  // `slots` is already in fill order (abstract, place, textures, verbs, nouns).
  const drawn: string[] = [];
  for (const slot of slots) {
    const e = fillSlot(slot, world, bank, picked, stats, rng);
    picked.add(e);
    drawn.push(e.w);
  }

  // Display order: locked words keep their cells; the rest are shuffled into the free cells.
  const cells: (string | null)[] = Array.from({ length: GRID_SIZE }, () => null);
  for (const l of locked) if (l.cell >= 0 && l.cell < GRID_SIZE) cells[l.cell] = l.w;
  const order = shuffled(drawn, rng);
  for (let i = 0; i < GRID_SIZE; i++) if (cells[i] === null) cells[i] = order.shift() ?? null;
  return { world, words: cells.filter((c): c is string => c !== null) };
}

/** Everyone gets the same daily grid: Medium, no locks, no stats. `_stats` is ignored on purpose. */
export function drawDaily(date: string, bank: readonly WordEntry[], _stats?: Stats): Grid {
  return drawGrid({ seed: dailySeed(date), difficulty: 'medium', bank });
}

export interface ShuffleInput {
  seedBase: string; // "page:<id>"
  shuffles: number;
  words: readonly string[];
  locked: readonly string[];
  difficulty: Difficulty;
  bank: readonly WordEntry[];
  stats?: Stats;
}

/** Redraws every unlocked word. Locked words stay in their cells. Doesn't use swaps. */
export function shuffleGrid({ seedBase, shuffles, words, locked, difficulty, bank, stats }: ShuffleInput): Grid & { shuffles: number } {
  const n = shuffles + 1;
  const lockedCells = words.flatMap((w, cell) => (locked.includes(w) ? [{ cell, w }] : []));
  const grid = drawGrid({ seed: `${seedBase}:shuffle:${n}`, difficulty, bank, locked: lockedCells, stats });
  return { ...grid, shuffles: n };
}

export interface SwapInput {
  seedBase: string;
  words: readonly string[];
  world: string;
  swapsUsed: number;
  cell: number;
  bank: readonly WordEntry[];
  stats?: Stats;
}

/** Replaces one word with a word of the same pos and themed status. Null once 3 swaps are used. */
export function swapInGrid({ seedBase, words, world, swapsUsed, cell, bank, stats }: SwapInput): { words: string[]; swapsUsed: number } | null {
  if (swapsUsed >= MAX_SWAPS) return null;
  const old = words[cell];
  if (old === undefined) return null;
  const { byW } = indexOf(bank);
  const oldEntry = byW.get(old);
  const picked = new Picked();
  words.forEach((w, i) => {
    const e = byW.get(w);
    if (e && i !== cell) picked.add(e);
  });
  picked.words.add(old); // never swap back to the same word
  const n = swapsUsed + 1;
  const e = fillSlot(
    { pos: oldEntry?.pos ?? 'noun', themed: oldEntry?.worlds.includes(world) ?? false },
    world,
    bank,
    picked,
    stats,
    rngFor(`${seedBase}:swap:${n}`),
  );
  const next = [...words];
  next[cell] = e.w;
  return { words: next, swapsUsed: n };
}

// ---------- Word ladder (WORDS.md section 5) ----------

export const LADDER_SIZE = 8;
export const LADDER_THEMED = 6;

export interface Ladder {
  world: string;
  nouns: string[];
  verbs: string[];
}

function fillColumn(pos: 'noun' | 'verb', world: string, bank: readonly WordEntry[], picked: Picked, stats: Stats | undefined, rng: Rng): string[] {
  const slots: Slot[] = Array.from({ length: LADDER_SIZE }, () => ({ pos, themed: false }));
  shuffled(slots, rng).slice(0, LADDER_THEMED).forEach((s) => (s.themed = true));
  return slots.map((slot) => {
    const e = fillSlot(slot, world, bank, picked, stats, rng);
    picked.add(e);
    return e.w;
  });
}

/** 8 nouns and 8 verbs from one world, Medium rules (6 themed per column), same root/rhyme/ban rules. */
export function drawLadder({ seed, bank, stats }: { seed: string; bank: readonly WordEntry[]; stats?: Stats }): Ladder {
  const rng = rngFor(seed);
  const world = WORLDS[Math.floor(rng() * WORLDS.length)] as string;
  const picked = new Picked();
  const nouns = fillColumn('noun', world, bank, picked, stats, rng);
  const verbs = fillColumn('verb', world, bank, picked, stats, rng);
  return { world, nouns, verbs };
}

/** Redraws one column on its own seed (page:<id>:nouns:<n>), keeping the world and the other column. */
export function shuffleColumn({
  seedBase, column, n, ladder, bank, stats,
}: { seedBase: string; column: 'nouns' | 'verbs'; n: number; ladder: Ladder; bank: readonly WordEntry[]; stats?: Stats }): string[] {
  const { byW } = indexOf(bank);
  const picked = new Picked();
  const other = column === 'nouns' ? ladder.verbs : ladder.nouns;
  for (const w of other) {
    const e = byW.get(w);
    if (e) picked.add(e);
  }
  // Never redraw the words being replaced.
  for (const w of ladder[column]) picked.words.add(w);
  return fillColumn(column === 'nouns' ? 'noun' : 'verb', ladder.world, bank, picked, stats, rngFor(`${seedBase}:${column}:${n}`));
}
