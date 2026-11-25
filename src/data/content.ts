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

export const loadObjects = lazy<ObjectItem[]>('objects', () => import('./objects.json'));

/** Loads a bank and returns it once ready (null until then). */
export function useContent<T>(loader: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    void loader().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [loader]);
  return data;
}
