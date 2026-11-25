// Exercise banks (objects, lines, titles, dice, characters), each loaded on first use.
import { useEffect, useState } from 'react';

export interface ObjectItem {
  text: string;
  worlds: string[];
}

const cache = new Map<string, Promise<unknown>>();

function lazy<T>(key: string, load: () => Promise<{ default: unknown }>): () => Promise<T> {
  return () => {
    if (!cache.has(key)) cache.set(key, load().then((m) => m.default));
    return cache.get(key) as Promise<T>;
  };
}

export interface TitleItem {
  text: string;
  /** Words that must land in the chorus, with their forms (from npm run bank). */
  words: { w: string; forms: string[] }[];
}

export const loadObjects = lazy<ObjectItem[]>('objects', () => import('./objects.json'));
export const loadTitles = lazy<TitleItem[]>('titles', () => import('./titles.json'));

/** Loads a bank and returns it once ready (null until then, or if `loader` is null). */
export function useContent<T>(loader: (() => Promise<T>) | null): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!loader) return;
    let live = true;
    void loader().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [loader]);
  return data;
}
