// "Surprise me" (SPEC.md): exercises used least recently are more likely.
import { daysBetween } from './date';
import type { ExerciseType } from './exercises';
import { pickWeighted, rngFor } from './random';

export const SURPRISE_CAP = 30;

/** Days since last used + 1, capped at 30. Never used = 30. */
export function surpriseWeight(last: string | undefined, today: string): number {
  if (!last) return SURPRISE_CAP;
  return Math.min(SURPRISE_CAP, Math.max(0, daysBetween(last, today)) + 1);
}

export function pickSurprise(types: readonly ExerciseType[], last: ReadonlyMap<ExerciseType, string>, today: string, seed: string): ExerciseType {
  return pickWeighted(types, (t) => surpriseWeight(last.get(t), today), rngFor(seed));
}
