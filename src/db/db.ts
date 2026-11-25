import { Dexie, type Table } from 'dexie';
import type { AudioRow, Memo, Page, SettingRow, SyncRow, UserLine, WordStat } from './types';

/**
 * Every schema change gets a new version with a migration. Never drop user data.
 * Note: IndexedDB can't index booleans, so rows never appear in the `archived` index.
 * Filter on `archived` in code.
 */
export class MarginsDB extends Dexie {
  pages!: Table<Page, string>;
  memos!: Table<Memo, string>;
  audio!: Table<AudioRow, string>;
  wordStats!: Table<WordStat, string>;
  userLines!: Table<UserLine, string>;
  settings!: Table<SettingRow, string>;
  sync!: Table<SyncRow, string>;

  constructor() {
    super('margins');
    this.version(1).stores({
      pages: 'id, updatedAt, exercise, archived',
      memos: 'id, pageId, createdAt',
      wordStats: 'w',
      userLines: 'id, kind',
      settings: 'key',
    });

    // v2: recordings move out of `memos` into `audio`; `sync` holds Dropbox state.
    this.version(2)
      .stores({ audio: 'id', sync: 'key' })
      .upgrade(async (tx) => {
        const memos = await tx.table('memos').toArray();
        const rows: AudioRow[] = [];
        for (const m of memos as (Memo & { audio?: ArrayBuffer; blob?: Blob })[]) {
          const data = m.audio ?? m.blob;
          if (data) rows.push({ id: m.id, data, mimeType: m.mimeType });
        }
        await tx.table('audio').bulkPut(rows);
        await tx
          .table('memos')
          .toCollection()
          .modify((m: Record<string, unknown>) => {
            delete m.audio;
            delete m.blob;
          });
      });
  }
}

export const db = new MarginsDB();
