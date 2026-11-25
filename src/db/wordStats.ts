import type { Stats } from '../lib/draw';
import { db } from './db';
import type { Page, WordStat } from './types';

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

/**
 * Brings wordStats.used in line with one page: +1 for words used now but not yet counted on it,
 * -1 for counted words it no longer uses. Doesn't touch the page's updatedAt.
 */
export async function recordUsed(pageId: string, usedNow: readonly string[]): Promise<void> {
  await db.transaction('rw', db.pages, db.wordStats, async () => {
    const page = await db.pages.get(pageId);
    if (!page || (page.exercise !== 'grid' && page.exercise !== 'ladder')) return;
    const state = page.state as { counted?: string[] };
    const before = new Set(state.counted ?? []);
    const now = new Set(usedNow);
    const added = [...now].filter((w) => !before.has(w));
    const removed = [...before].filter((w) => !now.has(w));
    if (!added.length && !removed.length) return;
    const rows = await db.wordStats.bulkGet([...added, ...removed]);
    await db.wordStats.bulkPut(
      [...added, ...removed].map((w, i) => {
        const s = rows[i] ?? blank(w);
        s.used = Math.max(0, s.used + (i < added.length ? 1 : -1));
        return s;
      }),
    );
    await db.pages.update(pageId, { state: { ...(page.state as object), counted: [...now] } as Page['state'] });
  });
}
