import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronIcon } from '../components/Icons';
import { DropboxSection } from '../components/DropboxSection';
import { MyLines } from '../components/MyLines';
import { Segmented } from '../components/Segmented';
import { ConfirmSheet } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { exportBackup, importBackup } from '../db/backup';
import { db } from '../db/db';
import { deletePageForever, setArchived } from '../db/pages';
import { setSetting, useSettings } from '../db/settings';
import type { Page } from '../db/types';
import { localDate, pageTitleDate, relativeDay } from '../lib/date';
import { exerciseName } from '../lib/exercises';
import { plural } from '../lib/format';
import { previewLines } from '../lib/pad';
import { useToast } from '../state/toast';
import { useDropbox } from '../sync/dropbox';

export function Settings() {
  const settings = useSettings();
  const dropbox = useDropbox();
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

      <DropboxSection />

      {settings && (
        <section className="settings-section">
          <h2 className="section-label">New pages</h2>
          <div className="settings-field">
            <span className="settings-field__label">Grid difficulty</span>
            <Segmented
              label="Grid difficulty"
              value={settings.difficulty}
              options={[['loose', 'Loose'], ['medium', 'Medium'], ['wild', 'Wild']]}
              onChange={(v) => void setSetting('difficulty', v)}
            />
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Daily grid</span>
            <Segmented
              label="Daily grid"
              value={settings.dailyGrid ? 'on' : 'off'}
              options={[['off', 'Off'], ['on', 'On']]}
              onChange={(v) => void setSetting('dailyGrid', v === 'on')}
            />
            <span className="settings-note">On: every new grid is the day's shared grid.</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Detection level</span>
            <Segmented
              label="Detection level"
              value={settings.level}
              options={[['exact', 'Exact'], ['root', 'Root'], ['loose', 'Loose']]}
              onChange={(v) => void setSetting('level', v)}
            />
            <span className="settings-note">Root counts burned for burn. Loose also counts rusty for rust.</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Object writing timer</span>
            <Segmented
              label="Object writing timer"
              value={String(settings.objectTimerMin) as '5' | '10' | '15'}
              options={[['5', '5 min'], ['10', '10 min'], ['15', '15 min']]}
              onChange={(v) => void setSetting('objectTimerMin', Number(v) as 5 | 10 | 15)}
            />
          </div>
        </section>
      )}

      <section className="settings-section">
        <h2 className="section-label">Backup file</h2>
        <p className="settings-note">
          {last ? `Last backup file: ${relativeDay(localDate(new Date(last)))}.` : 'No backup file yet.'}
          {!dropbox?.connected && ' Everything lives on this device. A backup is the only copy anywhere else.'}
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

      <MyLines />

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
