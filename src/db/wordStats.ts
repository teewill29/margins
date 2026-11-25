import type { Stats } from '../lib/draw';
import { db } from './db';
import type { WordStat } from './types';

const blank = (w: string): WordStat => ({ w, shown: 0, used: 0, swaps: 0, banned: false, favorite: false });

export async function statsMap(): Promise<Stats> {
  return new Map((await db.wordStats.toArray()).map((s) => [s.w, s]));
}

async function change(words: readonly string[], fn: (s: WordStat) => void): Promise<void> {
  await db.transaction('rw', db.wordStats, async () => {
    const rows = await db.wordStats.bulkGet([...words]);
    await db.wordStats.bulkPut(
      words.map((w, i) => {
        const s = rows[i] ?? blank(w);
        fn(s);
        return s;
      }),
    );
  });
}

export const recordShown = (words: readonly string[]) => change(words, (s) => void (s.shown += 1));
export const recordSwap = (w: string) => change([w], (s) => void (s.swaps += 1));
export const setBanned = (w: string, banned: boolean) => change([w], (s) => void (s.banned = banned));
export const setFavorite = (w: string, favorite: boolean) => change([w], (s) => void (s.favorite = favorite));
