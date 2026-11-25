import { describe, expect, it } from 'vitest';
import { backupBanner, backupFileName, extForMime, rowsToImport } from './backup';

describe('backup names', () => {
  it('names the file by local date', () => {
    expect(backupFileName('2026-11-24')).toBe('margins-backup-2026-11-24.zip');
  });
  it('maps MIME types to extensions', () => {
    expect(extForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extForMime('audio/webm')).toBe('webm');
    expect(extForMime('audio/mp4')).toBe('m4a');
    expect(extForMime('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(extForMime('')).toBe('bin');
  });
});

describe('rowsToImport', () => {
  const key = (r: { id: string }) => r.id;
  const stamp = (r: { t: number }) => r.t;
  const local = new Map([
    ['a', { id: 'a', t: 10, v: 'local a' }],
    ['b', { id: 'b', t: 10, v: 'local b' }],
  ]);
  it('adds missing rows and replaces only with newer ones', () => {
    const incoming = [
      { id: 'a', t: 5, v: 'old a' },
      { id: 'b', t: 20, v: 'new b' },
      { id: 'c', t: 1, v: 'c' },
    ];
    expect(rowsToImport(local, incoming, key, stamp).map((r) => r.v)).toEqual(['new b', 'c']);
  });
  it('does nothing on an equal timestamp', () => {
    expect(rowsToImport(local, [{ id: 'a', t: 10, v: 'same' }], key, stamp)).toEqual([]);
  });
});

describe('backupBanner', () => {
  const day = 86_400_000;
  const now = new Date(2026, 10, 24, 12).getTime();
  const page = (ageDays: number) => ({ createdAt: now - ageDays * day, updatedAt: now - ageDays * day });

  it('shows after 7 days when a page changed since', () => {
    expect(backupBanner({ now, lastBackupAt: now - 9 * day, dismissedAt: null, pages: [page(2)] })).toBe(
      'Back up your notebook. Last backup 9 days ago.',
    );
  });
  it('stays hidden within 7 days', () => {
    expect(backupBanner({ now, lastBackupAt: now - 7 * day, dismissedAt: null, pages: [page(1)] })).toBeNull();
  });
  it('stays hidden when nothing changed since the backup', () => {
    expect(backupBanner({ now, lastBackupAt: now - 20 * day, dismissedAt: null, pages: [page(30)] })).toBeNull();
  });
  it('counts from the oldest page when there has never been a backup', () => {
    expect(backupBanner({ now, lastBackupAt: null, dismissedAt: null, pages: [page(3)] })).toBeNull();
    expect(backupBanner({ now, lastBackupAt: null, dismissedAt: null, pages: [page(3), page(10)] })).toBe(
      'Back up your notebook. No backup yet.',
    );
  });
  it('hides for 7 days after dismissing', () => {
    const base = { now, lastBackupAt: now - 30 * day, pages: [page(1)] };
    expect(backupBanner({ ...base, dismissedAt: now - 2 * day })).toBeNull();
    expect(backupBanner({ ...base, dismissedAt: now - 8 * day })).not.toBeNull();
  });
  it('stays hidden with no pages', () => {
    expect(backupBanner({ now, lastBackupAt: null, dismissedAt: null, pages: [] })).toBeNull();
  });
});
