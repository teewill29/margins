// Seeded picks for the exercise banks (WORDS.md section 6). Never Math.random().
import { randomInt, rngFor } from './random';

/**
 * A seeded index into `n` items, avoiding the indexes in `avoid` when possible
 * (the current item, or the last 20 shown).
 */
export function pickIndex(seed: string, n: number, avoid: ReadonlySet<number> = new Set()): number {
  if (n <= 0) return -1;
  const rng = rngFor(seed);
  const open: number[] = [];
  for (let i = 0; i < n; i++) if (!avoid.has(i)) open.push(i);
  const pool = open.length ? open : Array.from({ length: n }, (_, i) => i);
  return pool[randomInt(rng, pool.length)] as number;
}

/** Picks an item by text, skipping recently shown texts. */
export function pickText<T extends { text: string }>(seed: string, items: readonly T[], recent: readonly string[]): T | undefined {
  const skip = new Set(recent);
  const avoid = new Set<number>();
  items.forEach((it, i) => skip.has(it.text) && avoid.add(i));
  return items[pickIndex(seed, items.length, avoid)];
}

/** Keeps the last `max` shown texts, newest last. */
export function remember(recent: readonly string[], text: string, max = 20): string[] {
  return [...recent.filter((t) => t !== text), text].slice(-max);
}
