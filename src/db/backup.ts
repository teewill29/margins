import JSZip from 'jszip';
import { BACKUP_VERSION, backupFileName, extForMime, rowsToImport } from '../lib/backup';
import { localDate } from '../lib/date';
import { isIOS } from '../platform';
import { db } from './db';
import { memoBlob } from './memos';
import { setSetting } from './settings';
import type { Memo, Page, SettingRow, UserLine, WordStat } from './types';

type MemoMeta = Omit<Memo, 'blob' | 'audio'>;

interface BackupJson {
  version: number;
  exportedAt: number;
  pages: Page[];
  memos: MemoMeta[];
  wordStats: WordStat[];
  userLines: UserLine[];
  settings: SettingRow[];
}

/** Builds the backup zip: margins.json plus one audio file per memo. */
export async function buildBackup(): Promise<File> {
  const zip = new JSZip();
  const [pages, memos, wordStats, userLines, settings] = await Promise.all([
    db.pages.toArray(),
    db.memos.toArray(),
    db.wordStats.toArray(),
    db.userLines.toArray(),
    db.settings.toArray(),
  ]);
  const audio = zip.folder('audio');
  const metas: MemoMeta[] = [];
  for (const memo of memos) {
    const { blob: _blob, audio: _audio, ...meta } = memo;
    metas.push(meta);
    audio?.file(`${meta.id}.${extForMime(meta.mimeType)}`, memoBlob(memo), { compression: 'STORE' });
  }
  const json: BackupJson = { version: BACKUP_VERSION, exportedAt: Date.now(), pages, memos: metas, wordStats, userLines, settings };
  zip.file('margins.json', JSON.stringify(json, null, 1), { compression: 'DEFLATE' });
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], backupFileName(localDate()), { type: 'application/zip' });
}

/**
 * Hands a file to the user: the share sheet on iOS (so it can go to Files), a download elsewhere.
 * Returns false if the user cancelled the share sheet.
 */
export async function deliverFile(file: File): Promise<boolean> {
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Share failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function exportBackup(): Promise<boolean> {
  const file = await buildBackup();
  const done = await deliverFile(file);
  if (done) await setSetting('lastBackupAt', Date.now());
  return done;
}

export interface ImportResult {
  pages: number;
  memos: number;
  missingAudio: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const rowsWith = <T>(v: unknown, idKey: string): T[] =>
  Array.isArray(v) ? (v.filter((r) => isObj(r) && typeof r[idKey] === 'string') as T[]) : [];

/** Reads a backup zip and merges it in. Newer rows win; nothing is ever deleted. */
export async function importBackup(file: Blob): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("That file isn't a Margins backup.");
  }
  const jsonFile = zip.file('margins.json');
  if (!jsonFile) throw new Error("That file isn't a Margins backup.");
  const data: unknown = JSON.parse(await jsonFile.async('string'));
  if (!isObj(data) || data.version !== BACKUP_VERSION) throw new Error("This backup is from a version Margins can't read.");

  const pages = rowsWith<Page>(data.pages, 'id');
  const metas = rowsWith<MemoMeta>(data.memos, 'id');
  const wordStats = rowsWith<WordStat>(data.wordStats, 'w');
  const userLines = rowsWith<UserLine>(data.userLines, 'id');
  const settings = rowsWith<SettingRow>(data.settings, 'key');

  // Read audio before the transaction: IndexedDB transactions can't wait on other async work.
  const audioFiles = zip.folder('audio')?.file(/.*/) ?? [];
  const audioById = new Map(audioFiles.map((f) => [f.name.replace(/^audio\//, '').replace(/\.[^.]+$/, ''), f]));

  const localPages = new Map((await db.pages.toArray()).map((p) => [p.id, p]));
  const localMemos = new Map((await db.memos.toArray()).map((m) => [m.id, m]));
  const pagesIn = rowsToImport(localPages, pages, (p) => p.id, (p) => p.updatedAt);
  const memoMetasIn = rowsToImport<MemoMeta>(localMemos, metas, (m) => m.id, (m) => m.createdAt);

  const memosIn: Memo[] = [];
  let missingAudio = 0;
  for (const meta of memoMetasIn) {
    const f = audioById.get(meta.id);
    if (!f) {
      missingAudio++;
      continue;
    }
    memosIn.push({ ...meta, audio: await f.async('arraybuffer') });
  }

  const localLines = new Map((await db.userLines.toArray()).map((l) => [l.id, l]));
  const linesIn = rowsToImport(localLines, userLines, (l) => l.id, (l) => l.createdAt);
  // Word stats and settings have no timestamps: only fill in what's missing here.
  const localStatKeys = new Set(await db.wordStats.toCollection().primaryKeys());
  const localSettingKeys = new Set(await db.settings.toCollection().primaryKeys());

  await db.transaction('rw', [db.pages, db.memos, db.userLines, db.wordStats, db.settings], async () => {
    await db.pages.bulkPut(pagesIn);
    await db.memos.bulkPut(memosIn);
    await db.userLines.bulkPut(linesIn);
    await db.wordStats.bulkPut(wordStats.filter((s) => !localStatKeys.has(s.w)));
    await db.settings.bulkPut(settings.filter((s) => !localSettingKeys.has(s.key)));
  });

  return { pages: pagesIn.length, memos: memosIn.length, missingAudio };
}
