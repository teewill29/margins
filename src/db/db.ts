import { Dexie, type Table } from 'dexie';
import type { Memo, Page, SettingRow, UserLine, WordStat } from './types';

/**
 * Every schema change gets a new version with a migration. Never drop user data.
 * Note: IndexedDB can't index booleans, so rows never appear in the `archived` index.
 * Filter on `archived` in code.
 */
export class MarginsDB extends Dexie {
  pages!: Table<Page, string>;
  memos!: Table<Memo, string>;
  wordStats!: Table<WordStat, string>;
  userLines!: Table<UserLine, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('margins');
    this.version(1).stores({
      pages: 'id, updatedAt, exercise, archived',
      memos: 'id, pageId, createdAt',
      wordStats: 'w',
      userLines: 'id, kind',
      settings: 'key',
    });
  }
}

export const db = new MarginsDB();
