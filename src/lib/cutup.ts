// Cut-up (SPEC.md): chop a text into scraps of 2 to 5 words, breaking at punctuation first,
// then at seeded word boundaries. Same text and seed give the same scraps.
import { randomInt, rngFor } from './random';

const BREAK_AFTER = /[.,;:!?)\]"”—–-]$/;
const MIN = 2;
const MAX = 5;

/** Strips punctuation from a scrap's ends, keeping apostrophes inside words. */
function tidy(words: readonly string[]): string {
  return words.join(' ').replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}']+$/u, '').replace(/[“”"]/g, '');
}

export function chop(text: string, seed: string): string[] {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return [];

  // 1. Clauses: break after punctuation. Lone words join the next clause (or the last one).
  const clauses: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    if (BREAK_AFTER.test(w)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);
  const merged: string[][] = [];
  for (const c of clauses) {
    const prev = merged[merged.length - 1];
    if (prev && prev.length < MIN) prev.push(...c);
    else merged.push([...c]);
  }
  const last = merged[merged.length - 1];
  if (last && last.length < MIN && merged.length > 1) {
    merged.pop();
    merged[merged.length - 1]?.push(...last);
  }

  // 2. Long clauses split at seeded boundaries into 2 to 5 words.
  const rng = rngFor(seed);
  const out: string[] = [];
  for (const clause of merged) {
    let rest = clause;
    while (rest.length > MAX) {
      // Leave at least MIN words for what follows.
      const most = Math.min(MAX, rest.length - MIN);
      const take = MIN + randomInt(rng, most - MIN + 1);
      out.push(tidy(rest.slice(0, take)));
      rest = rest.slice(take);
    }
    // Clauses of 4 or 5 words split about half the time, so Rechop always has something to change.
    if (rest.length >= MIN * 2 && rng() < 0.5) {
      const take = MIN + randomInt(rng, rest.length - MIN * 2 + 1);
      out.push(tidy(rest.slice(0, take)));
      rest = rest.slice(take);
    }
    if (rest.length) out.push(tidy(rest));
  }
  return out.filter(Boolean);
}
