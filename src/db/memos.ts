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

export async function saveMemo(m: NewMemo): Promise<Memo> {
  return db.transaction('rw', db.memos, db.pages, async () => {
    const count = await db.memos.where('pageId').equals(m.pageId).count();
    const memo: Memo = {
      id: crypto.randomUUID(),
      pageId: m.pageId,
      createdAt: Date.now(),
      label: `Memo ${count + 1}`,
      durationMs: m.durationMs,
      mimeType: m.mimeType,
      blob: m.blob,
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
