import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

/** All settings with defaults filled in. Undefined while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const rows = await db.settings.toArray();
    const s: Settings = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = r.value;
    return s;
  });
}

/** Ask the browser not to evict our data. Called once, on first launch. */
export async function requestPersistOnce(): Promise<void> {
  if (await getSetting('persistRequested')) return;
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported: nothing to do.
  }
  await setSetting('persistRequested', true);
}
