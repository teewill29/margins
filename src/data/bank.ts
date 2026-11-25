// The word bank, loaded on demand so pages without exercises don't download it.
import { useEffect, useState } from 'react';
import type { WordEntry } from '../lib/draw';

export interface Bank {
  words: readonly WordEntry[];
  byW: ReadonlyMap<string, WordEntry>;
}

let cached: Promise<Bank> | null = null;

export function loadBank(): Promise<Bank> {
  cached ??= import('./words.json').then((m) => {
    const words = m.default as WordEntry[];
    return { words, byW: new Map(words.map((e) => [e.w, e])) };
  });
  return cached;
}

export function useBank(): Bank | null {
  const [bank, setBank] = useState<Bank | null>(null);
  useEffect(() => {
    let live = true;
    void loadBank().then((b) => live && setBank(b));
    return () => {
      live = false;
    };
  }, []);
  return bank;
}
