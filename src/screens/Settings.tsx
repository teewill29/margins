import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronIcon } from '../components/Icons';
import { ConfirmSheet } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { exportBackup, importBackup } from '../db/backup';
import { db } from '../db/db';
import { deletePageForever, setArchived } from '../db/pages';
import { useSettings } from '../db/settings';
import type { Page } from '../db/types';
import { localDate, pageTitleDate, relativeDay } from '../lib/date';
import { exerciseName } from '../lib/exercises';
import { plural } from '../lib/format';
import { previewLines } from '../lib/pad';
import { useToast } from '../state/toast';

export function Settings() {
  const settings = useSettings();
  const archived = useLiveQuery(() => db.pages.orderBy('updatedAt').reverse().filter((p) => p.archived).toArray(), [], [] as Page[]);
  const memoCounts = useLiveQuery(async () => {
    const ids = await db.memos.orderBy('pageId').keys();
    const map = new Map<string, number>();
    for (const id of ids) map.set(String(id), (map.get(String(id)) ?? 0) + 1);
    return map;
  });
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [deleting, setDeleting] = useState<Page | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const doExport = async () => {
    setBusy('export');
    try {
      if (await exportBackup()) toast({ text: 'Backup saved' });
    } catch {
      toast({ text: "Couldn't make the backup. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File) => {
    setBusy('import');
    try {
      const r = await importBackup(file);
      const missing = r.missingAudio ? ` ${plural(r.missingAudio, 'memo')} had no audio and were skipped.` : '';
      toast({ text: `Imported ${plural(r.pages, 'page')} and ${plural(r.memos, 'memo')}.${missing}`, ms: 8000 });
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : "Couldn't read that backup." });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const last = settings?.lastBackupAt;

  return (
    <main className="screen screen--no-bar">
      <TopBar title="Settings" back="/" backLabel="Back to notebook" />

      <section className="settings-section">
        <h2 className="section-label">Backup</h2>
        <p className="settings-note">
          {last ? `Last backup: ${relativeDay(localDate(new Date(last)))}` : 'No backup yet.'}
          {' '}Everything lives on this device. A backup is the only copy anywhere else.
        </p>
        <div className="settings-row">
          <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={() => void doExport()}>
            {busy === 'export' ? 'Packing…' : 'Export backup'}
          </button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
            {busy === 'import' ? 'Importing…' : 'Import backup'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
            }}
          />
        </div>
        <p className="settings-note">Import adds pages from a backup. It never deletes anything here.</p>
        {persisted === false && (
          <p className="settings-note">This browser may clear storage when space runs low. Install Margins to the home screen and back up often.</p>
        )}
      </section>

      <section className="settings-section">
        <h2 className="section-label">Archived pages</h2>
        {archived.length === 0 && <p className="settings-note">Nothing archived.</p>}
        {archived.map((p) => (
          <div className="archived-row" key={p.id}>
            <div className="archived-row__text">
              <span className="archived-row__first">{p.title ?? previewLines(p.body, 1)[0] ?? pageTitleDate(p.date)}</span>
              <span className="archived-row__meta">
                {exerciseName(p.exercise)} · {relativeDay(p.date)}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void setArchived(p.id, false).then(() => toast({ text: 'Page restored' }))}
            >
              Restore
            </button>
            <button type="button" className="btn btn--small btn--quiet" onClick={() => setDeleting(p)}>
              Delete
            </button>
          </div>
        ))}
      </section>

      <Link to="/words" className="list-row">
        Word manager
        <ChevronIcon />
      </Link>

      {deleting && (
        <ConfirmSheet
          title="Delete forever?"
          body={`This removes the page${memoCounts?.get(deleting.id) ? ` and its ${plural(memoCounts.get(deleting.id) ?? 0, 'memo')}` : ''}. It can't be undone.`}
          confirm="Delete forever"
          onConfirm={() => void deletePageForever(deleting.id).then(() => toast({ text: 'Page deleted' }))}
          onClose={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
