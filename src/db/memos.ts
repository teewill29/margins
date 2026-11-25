import type { Pin } from '../lib/pins';
import { db } from './db';
import type { AudioRow, Memo } from './types';

export interface NewMemo {
  pageId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  pin: Pin | null;
}

export function audioBlob(row: AudioRow): Blob {
  return row.data instanceof Blob ? row.data : new Blob([row.data], { type: row.mimeType });
}

export async function saveMemo(m: NewMemo): Promise<Memo> {
  // Read the bytes before the transaction: IndexedDB transactions close if they wait on anything else.
  const data = await m.blob.arrayBuffer();
  return db.transaction('rw', [db.memos, db.audio, db.pages], async () => {
    const count = await db.memos.where('pageId').equals(m.pageId).count();
    const memo: Memo = {
      id: crypto.randomUUID(),
      pageId: m.pageId,
      createdAt: Date.now(),
      label: `Memo ${count + 1}`,
      durationMs: m.durationMs,
      mimeType: m.mimeType,
      pinnedLine: m.pin?.line ?? null,
      pinnedText: m.pin?.text ?? null,
      tags: [],
    };
    await db.audio.add({ id: memo.id, data, mimeType: m.mimeType });
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

export interface DeletedMemo {
  memo: Memo;
  audio: AudioRow | undefined;
}

/** Deletes a memo and its audio, and returns both so an undo can put them back. */
export async function deleteMemo(id: string): Promise<DeletedMemo | undefined> {
  return db.transaction('rw', db.memos, db.audio, async () => {
    const memo = await db.memos.get(id);
    if (!memo) return undefined;
    const audio = await db.audio.get(id);
    await db.memos.delete(id);
    await db.audio.delete(id);
    return { memo, audio };
  });
}

export async function restoreMemo({ memo, audio }: DeletedMemo): Promise<void> {
  await db.transaction('rw', db.memos, db.audio, async () => {
    if (audio) await db.audio.put(audio);
    await db.memos.put(memo);
  });
}
