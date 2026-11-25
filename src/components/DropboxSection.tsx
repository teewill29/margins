import { useEffect, useState } from 'react';
import { localDate, shortDate } from '../lib/date';
import { plural, timeAgo } from '../lib/format';
import {
  disconnect,
  dropboxConfigured,
  finishWithCode,
  mergeFromDropbox,
  startCodeConnect,
  startConnect,
  syncNow,
  useDropbox,
} from '../sync/dropbox';
import { useToast } from '../state/toast';

const short = (ms: number) => shortDate(localDate(new Date(ms)));

export function DropboxSection() {
  const view = useDropbox();
  const toast = useToast();
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!dropboxConfigured) {
    return (
      <section className="settings-section">
        <h2 className="section-label">Dropbox</h2>
        <p className="settings-note">Automatic Dropbox backup isn't set up in this build yet. It needs an app key.</p>
      </section>
    );
  }
  if (!view) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ text: e instanceof Error ? e.message : 'Something went wrong.', ms: 8000 });
    } finally {
      setBusy(false);
    }
  };

  const merge = () =>
    run(async () => {
      const r = await mergeFromDropbox();
      const missing = r.missingAudio ? ` ${plural(r.missingAudio, 'memo')} had no audio in Dropbox.` : '';
      toast({ text: `Got ${plural(r.pages, 'page')} and ${plural(r.memos, 'memo')} from Dropbox.${missing}`, ms: 8000 });
    });

  if (!view.connected) {
    return (
      <section className="settings-section">
        <h2 className="section-label">Dropbox</h2>
        <p className="settings-note">
          Back up to your own Dropbox automatically. Each memo uploads once. Your pages upload after changes, with a
          dated copy each day.
        </p>
        {view.state.message && <p className="settings-note settings-note--alert">{view.state.message}</p>}
        {!codeMode ? (
          <div className="settings-row">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run(startConnect)}>
              Connect Dropbox
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setCodeMode(true)}>
              Use a code instead
            </button>
          </div>
        ) : (
          <form
            className="settings-col"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await finishWithCode(code);
                setCodeMode(false);
                setCode('');
                toast({ text: 'Dropbox connected' });
              });
            }}
          >
            <p className="settings-note">Tap Open Dropbox, allow access, copy the code it shows, and paste it here.</p>
            <div className="settings-row">
              <button type="button" className="btn" onClick={() => void run(startCodeConnect)}>
                Open Dropbox
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setCodeMode(false)}>
                Cancel
              </button>
            </div>
            <input
              className="text-input"
              aria-label="Code from Dropbox"
              placeholder="Paste the code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn--primary" disabled={busy || !code.trim()}>
              Connect
            </button>
          </form>
        )}
      </section>
    );
  }

  const s = view.state;
  const status =
    s.status === 'running'
      ? 'Backing up…'
      : s.status === 'conflict'
        ? `${s.message ?? 'Dropbox has a copy this device has not seen.'} Merge it to keep backing up. Nothing is deleted.`
        : s.status === 'offline'
          ? `Offline. Backs up when you're back online.${s.lastSyncAt ? ` Last backup ${timeAgo(s.lastSyncAt, now, short)}.` : ''}`
          : s.status === 'error'
            ? `Backup failed: ${s.message ?? 'unknown error'}. Trying again later.`
            : s.lastSyncAt
              ? `Backed up ${timeAgo(s.lastSyncAt, now, short)}.`
              : 'Not backed up yet.';

  return (
    <section className="settings-section">
      <h2 className="section-label">Dropbox</h2>
      <p className="settings-note">{view.accountName ? `Connected as ${view.accountName}.` : 'Connected.'}</p>
      <p className={s.status === 'conflict' || s.status === 'error' ? 'settings-note settings-note--alert' : 'settings-note'} role="status">
        {status}
      </p>
      <div className="settings-row">
        {s.status === 'conflict' ? (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void merge()}>
            Merge with Dropbox
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={busy || s.status === 'running'} onClick={() => void run(syncNow)}>
            Back up now
          </button>
        )}
        {s.status !== 'conflict' && (
          <button type="button" className="btn" disabled={busy || s.status === 'running'} onClick={() => void merge()}>
            Restore from Dropbox
          </button>
        )}
      </div>
      {s.status !== 'conflict' && <p className="settings-note">Restore adds anything in Dropbox that's missing here. It never deletes.</p>}
      <button type="button" className="btn btn--quiet btn--small btn--self-start" disabled={busy} onClick={() => void run(disconnect)}>
        Disconnect
      </button>
    </section>
  );
}
