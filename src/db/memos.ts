import type { Pin } from '../lib/pins';
import { db } from './db';
import type { Memo } from './types';

export interface NewMemo {
  pageId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  pin: Pin | null;
}

/** The memo's audio as a Blob, whichever way it was stored. */
export function memoBlob(m: Memo): Blob {
  if (m.audio) return new Blob([m.audio], { type: m.mimeType });
  return m.blob ?? new Blob([], { type: m.mimeType });
}

export async function saveMemo(m: NewMemo): Promise<Memo> {
  // Read the bytes before the transaction: IndexedDB transactions close if they wait on anything else.
  const audio = await m.blob.arrayBuffer();
  return db.transaction('rw', db.memos, db.pages, async () => {
    const count = await db.memos.where('pageId').equals(m.pageId).count();
    const memo: Memo = {
      id: crypto.randomUUID(),
      pageId: m.pageId,
      createdAt: Date.now(),
      label: `Memo ${count + 1}`,
      durationMs: m.durationMs,
      mimeType: m.mimeType,
      audio,
      pinnedLine: m.pin?.line ?? null,
      pinnedText: m.pin?.text ?? null,
      tags: [],
    };
    await db.memos.add(memo);
    await db.pages.update(m.pageId, { updatedAt: Date.now() });
    return memo;
  });
}

export async function renameMemo(id: string, label: string): Promise<void> {
  const t = label.trim();
  if (t) await db.memos.update(id, { label: t });
}

export async function unpinMemo(id: string): Promise<void> {
  await db.memos.update(id, { pinnedLine: null, pinnedText: null });
}

/** Deletes and returns the memo so an undo can put it back with `restoreMemo`. */
export async function deleteMemo(id: string): Promise<Memo | undefined> {
  const memo = await db.memos.get(id);
  if (memo) await db.memos.delete(id);
  return memo;
}

export async function restoreMemo(memo: Memo): Promise<void> {
  await db.memos.put(memo);
}
