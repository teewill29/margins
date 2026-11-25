import JSZip from 'jszip';
import { BACKUP_VERSION, backupFileName, extForMime, rowsToImport } from '../lib/backup';
import { localDate } from '../lib/date';
import { isIOS } from '../platform';
import { db } from './db';
import { audioBlob } from './memos';
import { setSetting } from './settings';
import type { AudioRow, Memo, Page, SettingRow, UserLine, WordStat } from './types';

/** `margins.json`, in a backup zip and in Dropbox. Everything except audio and device-only state. */
export interface BackupJson {
  version: number;
  exportedAt: number;
  pages: Page[];
  memos: Memo[];
  wordStats: WordStat[];
  userLines: UserLine[];
  settings: SettingRow[];
}

export async function buildBackupJson(): Promise<BackupJson> {
  const [pages, memos, wordStats, userLines, settings] = await Promise.all([
    db.pages.toArray(),
    db.memos.toArray(),
    db.wordStats.toArray(),
    db.userLines.toArray(),
    db.settings.toArray(),
  ]);
  return { version: BACKUP_VERSION, exportedAt: Date.now(), pages, memos, wordStats, userLines, settings };
}

export function audioPath(memo: Pick<Memo, 'id' | 'mimeType'>): string {
  return `audio/${memo.id}.${extForMime(memo.mimeType)}`;
}

/** Builds the backup zip: margins.json plus one audio file per memo. */
export async function buildBackup(): Promise<File> {
  const zip = new JSZip();
  const json = await buildBackupJson();
  const mimes = new Map(json.memos.map((m) => [m.id, m.mimeType]));
  await db.audio.each((row) => {
    if (!mimes.has(row.id)) return;
    zip.file(audioPath({ id: row.id, mimeType: mimes.get(row.id) ?? row.mimeType }), audioBlob(row), { compression: 'STORE' });
  });
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

/**
 * Merges a backup into this device. Newer rows win; nothing here is ever deleted or downgraded.
 * `getAudio` fetches a memo's recording; memos whose audio can't be found are skipped.
 */
export async function mergeBackup(
  data: unknown,
  getAudio: (memo: Memo) => Promise<ArrayBuffer | null>,
): Promise<ImportResult> {
  if (!isObj(data) || data.version !== BACKUP_VERSION) throw new Error("This backup is from a version Margins can't read.");

  const pages = rowsWith<Page>(data.pages, 'id');
  const metas = rowsWith<Memo & { blob?: unknown; audio?: unknown }>(data.memos, 'id').map(({ blob: _b, audio: _a, ...m }) => m);
  const wordStats = rowsWith<WordStat>(data.wordStats, 'w');
  const userLines = rowsWith<UserLine>(data.userLines, 'id');
  const settings = rowsWith<SettingRow>(data.settings, 'key');

  const localPages = new Map((await db.pages.toArray()).map((p) => [p.id, p]));
  const localMemos = new Map((await db.memos.toArray()).map((m) => [m.id, m]));
  const localLines = new Map((await db.userLines.toArray()).map((l) => [l.id, l]));
  const pagesIn = rowsToImport(localPages, pages, (p) => p.id, (p) => p.updatedAt);
  const memosNew = rowsToImport(localMemos, metas, (m) => m.id, (m) => m.createdAt);
  const linesIn = rowsToImport(localLines, userLines, (l) => l.id, (l) => l.createdAt);

  // Fetch audio before the transaction: IndexedDB transactions can't wait on other async work.
  const memosIn: Memo[] = [];
  const audioIn: AudioRow[] = [];
  let missingAudio = 0;
  for (const meta of memosNew) {
    const data = await getAudio(meta);
    if (!data) {
      missingAudio++;
      continue;
    }
    memosIn.push(meta);
    audioIn.push({ id: meta.id, data, mimeType: meta.mimeType });
  }

  // Word stats and settings have no timestamps: only fill in what's missing here.
  const localStatKeys = new Set(await db.wordStats.toCollection().primaryKeys());
  const localSettingKeys = new Set(await db.settings.toCollection().primaryKeys());

  await db.transaction('rw', [db.pages, db.memos, db.audio, db.userLines, db.wordStats, db.settings], async () => {
    await db.pages.bulkPut(pagesIn);
    await db.audio.bulkPut(audioIn);
    await db.memos.bulkPut(memosIn);
    await db.userLines.bulkPut(linesIn);
    await db.wordStats.bulkPut(wordStats.filter((s) => !localStatKeys.has(s.w)));
    await db.settings.bulkPut(settings.filter((s) => !localSettingKeys.has(s.key)));
  });

  return { pages: pagesIn.length, memos: memosIn.length, missingAudio };
}

/** Reads a backup zip and merges it in. */
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
  const byId = new Map(
    (zip.folder('audio')?.file(/.*/) ?? []).map((f) => [f.name.replace(/^audio\//, '').replace(/\.[^.]+$/, ''), f]),
  );
  return mergeBackup(data, async (memo) => (await byId.get(memo.id)?.async('arraybuffer')) ?? null);
}
