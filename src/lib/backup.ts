// Pure parts of backup and restore. The zip and database work is in src/db/backup.ts.
import { daysBetween, localDate } from './date';

export const BACKUP_VERSION = 1;
const DAY = 86_400_000;

export function backupFileName(date: string): string {
  return `margins-backup-${date}.zip`;
}

/** File extension for a recorded audio MIME type (DATA_MODEL.md). */
export function extForMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'audio/webm' || base === 'video/webm') return 'webm';
  if (base === 'audio/mp4' || base === 'video/mp4' || base === 'audio/x-m4a' || base === 'audio/aac') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  return 'bin';
}

/**
 * Rows from a backup that should be written: ones missing locally, or newer than the local copy.
 * Never returns anything that would delete or downgrade a local row.
 */
export function rowsToImport<T>(
  local: ReadonlyMap<string, T>,
  incoming: readonly T[],
  key: (row: T) => string,
  stamp: (row: T) => number,
): T[] {
  const out: T[] = [];
  for (const row of incoming) {
    const mine = local.get(key(row));
    if (!mine || stamp(row) > stamp(mine)) out.push(row);
  }
  return out;
}

export interface BannerInput {
  now: number;
  lastBackupAt: number | null;
  dismissedAt: number | null;
  /** createdAt and updatedAt of every page that isn't archived */
  pages: readonly { createdAt: number; updatedAt: number }[];
}

/**
 * The Notebook's "Back up your notebook" banner. Shows when the last backup (or, if there has
 * never been one, the oldest page) is more than 7 days old and at least one page changed since.
 * Dismissing hides it for 7 days.
 */
export function backupBanner({ now, lastBackupAt, dismissedAt, pages }: BannerInput): string | null {
  if (dismissedAt !== null && now - dismissedAt < 7 * DAY) return null;
  const since = lastBackupAt ?? 0;
  const changed = pages.filter((p) => p.updatedAt > since);
  if (changed.length === 0) return null;
  const from = lastBackupAt ?? Math.min(...pages.map((p) => p.createdAt));
  const days = daysBetween(localDate(new Date(from)), localDate(new Date(now)));
  if (days <= 7) return null;
  return lastBackupAt === null
    ? 'Back up your notebook. No backup yet.'
    : `Back up your notebook. Last backup ${days} days ago.`;
}
