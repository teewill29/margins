// Automatic backup to the user's own Dropbox (app folder: Apps/<app name>/).
//   margins.json                 pages, memo details, settings. Replaced on each backup, but only
//                                if Dropbox still has the copy this device last wrote (else: conflict).
//   audio/<memoId>.<ext>         one file per memo, uploaded once, never overwritten.
//   snapshots/margins-DATE.json  a dated copy each day; the newest 30 are kept.
// Nothing else is ever deleted from Dropbox. Tokens live in the `sync` table, which backups skip.
import { useLiveQuery } from 'dexie-react-hooks';
import { DROPBOX_APP_KEY } from '../config';
import { audioPath, buildBackupJson, mergeBackup, type ImportResult } from '../db/backup';
import { db } from '../db/db';
import { localDate } from '../lib/date';
import { hashString } from '../lib/hash';
import { challengeFor, randomVerifier } from '../lib/pkce';
import { snapshotName, snapshotsToDelete } from '../lib/snapshots';

const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2/';
const CONTENT = 'https://content.dropboxapi.com/2/';
const DATA_PATH = '/margins.json';

interface Auth {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  accountName: string | null;
}
interface Pkce {
  verifier: string;
  state: string;
  redirectUri: string | null;
}
export type SyncStatus = 'idle' | 'running' | 'ok' | 'conflict' | 'offline' | 'error';
export interface SyncState {
  status: SyncStatus;
  message: string | null;
  lastSyncAt: number | null;
  dataRev: string | null;
  dataHash: string | null;
  lastSnapshotDate: string | null;
  uploadedAudio: string[];
}
const EMPTY_STATE: SyncState = {
  status: 'idle', message: null, lastSyncAt: null, dataRev: null, dataHash: null, lastSnapshotDate: null, uploadedAudio: [],
};

const KEY = { auth: 'dropbox.auth', state: 'dropbox.state', pkce: 'dropbox.pkce' } as const;

async function getRow<T>(key: string): Promise<T | null> {
  return ((await db.sync.get(key))?.value as T | undefined) ?? null;
}
async function setRow(key: string, value: unknown): Promise<void> {
  await db.sync.put({ key, value });
}
async function getState(): Promise<SyncState> {
  return { ...EMPTY_STATE, ...(await getRow<SyncState>(KEY.state)) };
}
async function patchState(patch: Partial<SyncState>): Promise<SyncState> {
  const next = { ...(await getState()), ...patch };
  await setRow(KEY.state, next);
  return next;
}

export const dropboxConfigured = DROPBOX_APP_KEY.length > 0;

// ---------- Errors ----------

export class DropboxError extends Error {
  readonly status: number;
  readonly summary: string;
  constructor(status: number, summary: string) {
    super(summary || `Dropbox error ${status}`);
    this.status = status;
    this.summary = summary;
  }
  get isConflict() {
    return this.status === 409 && /\/conflict/.test(this.summary);
  }
  get isNotFound() {
    return this.status === 409 && /not_found/.test(this.summary);
  }
}
class OfflineError extends Error {}
class SignedOutError extends Error {}

async function readError(res: Response): Promise<DropboxError> {
  let summary = '';
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error_summary?: string; error_description?: string; error?: string };
      summary = j.error_summary ?? j.error_description ?? j.error ?? text;
    } catch {
      summary = text;
    }
  } catch {
    // no body
  }
  return new DropboxError(res.status, summary.trim());
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new OfflineError('No connection');
  }
}

// ---------- Sign-in ----------

function redirectUri(): string {
  return `${location.origin}/auth/dropbox`;
}

async function authorizeUrl(withRedirect: boolean): Promise<string> {
  const verifier = randomVerifier();
  const state = randomVerifier().slice(0, 24);
  const pkce: Pkce = { verifier, state, redirectUri: withRedirect ? redirectUri() : null };
  await setRow(KEY.pkce, pkce);
  const q = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  if (withRedirect) {
    q.set('redirect_uri', redirectUri());
    q.set('state', state);
  }
  return `${AUTH_URL}?${q}`;
}

/** Leaves the app for Dropbox's sign-in page; it comes back to /auth/dropbox. */
export async function startConnect(): Promise<void> {
  location.assign(await authorizeUrl(true));
}

/** Fallback: Dropbox shows a code in a new tab, which the user pastes back here. */
export async function startCodeConnect(): Promise<void> {
  const url = await authorizeUrl(false);
  window.open(url, '_blank', 'noopener');
}

async function exchange(params: Record<string, string>): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const res = await send(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: DROPBOX_APP_KEY, ...params }),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

async function finish(code: string, pkce: Pkce): Promise<void> {
  const t = await exchange({
    grant_type: 'authorization_code',
    code: code.trim(),
    code_verifier: pkce.verifier,
    ...(pkce.redirectUri ? { redirect_uri: pkce.redirectUri } : {}),
  });
  if (!t.refresh_token) throw new Error('Dropbox did not grant lasting access.');
  await setRow(KEY.auth, {
    refreshToken: t.refresh_token,
    accessToken: t.access_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    accountName: null,
  } satisfies Auth);
  await db.sync.delete(KEY.pkce);
  await setRow(KEY.state, EMPTY_STATE);
  try {
    const acct = await rpc<{ name?: { display_name?: string } }>('users/get_current_account', null);
    const auth = await getRow<Auth>(KEY.auth);
    if (auth) await setRow(KEY.auth, { ...auth, accountName: acct.name?.display_name ?? null });
  } catch {
    // The name is only for display.
  }
  void syncNow();
}

/** Completes the redirect sign-in. Throws a readable Error on failure. */
export async function finishRedirect(search: URLSearchParams): Promise<void> {
  const err = search.get('error_description') ?? search.get('error');
  if (err) throw new Error(err === 'access_denied' ? 'Dropbox access was not allowed.' : err);
  const pkce = await getRow<Pkce>(KEY.pkce);
  const code = search.get('code');
  if (!pkce || !code || pkce.state !== search.get('state')) {
    throw new Error("This sign-in started somewhere else. Open Margins from your home screen and connect again, or use the code option.");
  }
  await finish(code, pkce);
}

/** Completes the code sign-in. */
export async function finishWithCode(code: string): Promise<void> {
  const pkce = await getRow<Pkce>(KEY.pkce);
  if (!pkce || pkce.redirectUri) throw new Error('Tap "Open Dropbox" first, then paste the code it shows.');
  await finish(code, pkce);
}

export async function disconnect(): Promise<void> {
  const auth = await getRow<Auth>(KEY.auth);
  if (auth) {
    // Best effort: the token is forgotten here either way.
    void send(`${API}auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => {});
  }
  await db.sync.bulkDelete([KEY.auth, KEY.state, KEY.pkce]);
}

async function accessToken(force = false): Promise<string> {
  const auth = await getRow<Auth>(KEY.auth);
  if (!auth) throw new SignedOutError('Not connected');
  if (!force && Date.now() < auth.expiresAt - 60_000) return auth.accessToken;
  try {
    const t = await exchange({ grant_type: 'refresh_token', refresh_token: auth.refreshToken });
    await setRow(KEY.auth, { ...auth, accessToken: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 });
    return t.access_token;
  } catch (e) {
    if (e instanceof DropboxError && e.status === 400) {
      await db.sync.delete(KEY.auth);
      throw new SignedOutError('Dropbox access was removed. Connect again.');
    }
    throw e;
  }
}

/** Calls Dropbox, refreshing the token once on a 401. */
async function call(url: string, init: (token: string) => RequestInit): Promise<Response> {
  let res = await send(url, init(await accessToken()));
  if (res.status === 401) res = await send(url, init(await accessToken(true)));
  if (!res.ok) throw await readError(res);
  return res;
}

async function rpc<T>(endpoint: string, arg: unknown): Promise<T> {
  const res = await call(API + endpoint, (token) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  }));
  return res.json() as Promise<T>;
}

/** Dropbox-API-Arg must be ASCII; escape anything else. */
const apiArg = (v: unknown) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

type WriteMode = 'add' | 'overwrite' | { '.tag': 'update'; update: string };

async function upload(path: string, body: Blob | ArrayBuffer | string, mode: WriteMode): Promise<{ rev: string }> {
  const res = await call(CONTENT + 'files/upload', (token) => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': apiArg({ path, mode, autorename: false, mute: true }),
    },
    body,
  }));
  return res.json() as Promise<{ rev: string }>;
}

async function download(path: string): Promise<ArrayBuffer> {
  const res = await call(CONTENT + 'files/download', (token) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': apiArg({ path }) },
  }));
  return res.arrayBuffer();
}

// ---------- Backup ----------

let running: Promise<void> | null = null;
let again = false;

/** Backs up whatever changed. Safe to call often: only one run at a time, and unchanged data isn't re-sent. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function runOnce(): Promise<void> {
  if (!dropboxConfigured || !(await getRow<Auth>(KEY.auth))) return;
  const state = await getState();
  if (state.status === 'conflict') return; // waits for the user to merge
  if (!navigator.onLine) {
    await patchState({ status: 'offline', message: null });
    return;
  }
  await patchState({ status: 'running', message: null });
  try {
    // 1. Audio first, so margins.json never points at a file that isn't there yet.
    const uploaded = new Set(state.uploadedAudio);
    const memos = await db.memos.toArray();
    for (const m of memos) {
      if (uploaded.has(m.id)) continue;
      const row = await db.audio.get(m.id);
      if (!row) continue;
      try {
        await upload(`/${audioPath(m)}`, row.data, 'add');
      } catch (e) {
        if (!(e instanceof DropboxError && e.isConflict)) throw e; // already there: fine
      }
      uploaded.add(m.id);
      await patchState({ uploadedAudio: [...uploaded] });
    }

    // 2. margins.json, only if it changed, and only over the copy we last wrote.
    const json = await buildBackupJson();
    const body = JSON.stringify(json);
    const hash = hashString(JSON.stringify({ ...json, exportedAt: 0 }));
    let { dataRev } = await getState();
    if (hash !== state.dataHash || !dataRev) {
      try {
        const meta = await upload(DATA_PATH, body, dataRev ? { '.tag': 'update', update: dataRev } : 'add');
        dataRev = meta.rev;
        await patchState({ dataRev, dataHash: hash });
      } catch (e) {
        if (e instanceof DropboxError && e.isConflict) {
          await patchState({
            status: 'conflict',
            message: dataRev
              ? 'Dropbox has a newer copy from another device.'
              : 'Dropbox already has a Margins backup.',
          });
          return;
        }
        throw e;
      }
    }

    // 3. One dated snapshot a day; keep the newest 30.
    const today = localDate();
    if (state.lastSnapshotDate !== today) {
      await upload(`/snapshots/${snapshotName(today)}`, body, 'overwrite');
      await patchState({ lastSnapshotDate: today });
      try {
        const list = await rpc<{ entries: { name: string }[] }>('files/list_folder', { path: '/snapshots' });
        for (const name of snapshotsToDelete(list.entries.map((e) => e.name))) {
          await rpc('files/delete_v2', { path: `/snapshots/${name}` });
        }
      } catch {
        // Pruning can wait for another day.
      }
    }

    await patchState({ status: 'ok', message: null, lastSyncAt: Date.now() });
  } catch (e) {
    if (e instanceof OfflineError) await patchState({ status: 'offline', message: null });
    else if (e instanceof SignedOutError) await patchState({ status: 'error', message: e.message });
    else if (e instanceof DropboxError && e.status === 429) await patchState({ status: 'error', message: 'Dropbox is busy. Trying again soon.' });
    else await patchState({ status: 'error', message: e instanceof Error ? e.message : 'Backup failed.' });
  }
}

/**
 * Merges the Dropbox copy into this device (newer rows win, nothing is deleted), downloading any
 * audio this device is missing, then backs up the result. Restores a fresh install, and settles
 * a conflict.
 */
export async function mergeFromDropbox(): Promise<ImportResult> {
  await patchState({ status: 'running', message: null });
  try {
    let rev: string;
    try {
      rev = (await rpc<{ rev: string }>('files/get_metadata', { path: DATA_PATH })).rev;
    } catch (e) {
      if (e instanceof DropboxError && e.isNotFound) {
        await patchState({ status: 'idle', dataRev: null });
        await syncNow();
        return { pages: 0, memos: 0, missingAudio: 0 };
      }
      throw e;
    }
    const data: unknown = JSON.parse(new TextDecoder().decode(await download(DATA_PATH)));
    const got: string[] = [];
    const result = await mergeBackup(data, async (memo) => {
      try {
        const buf = await download(`/${audioPath(memo)}`);
        got.push(memo.id);
        return buf;
      } catch (e) {
        if (e instanceof DropboxError && e.isNotFound) return null;
        throw e;
      }
    });
    const state = await getState();
    await patchState({ status: 'idle', message: null, dataRev: rev, dataHash: null, uploadedAudio: [...new Set([...state.uploadedAudio, ...got])] });
    await syncNow();
    return result;
  } catch (e) {
    await patchState({ status: 'error', message: e instanceof Error ? e.message : 'Restore failed.' });
    throw e;
  }
}

// ---------- Scheduling ----------

const CHANGE_DELAY_MS = 45_000;
let started = false;

/** Backs up on launch, when back online, when the app is hidden, and 45 s after changes. */
export function startBackgroundSync(): void {
  if (started || !dropboxConfigured) return;
  started = true;
  let timer: number | undefined;
  const soon = () => {
    if (timer === undefined) timer = window.setTimeout(() => {
      timer = undefined;
      void syncNow();
    }, CHANGE_DELAY_MS);
  };
  const now = () => {
    window.clearTimeout(timer);
    timer = undefined;
    void syncNow();
  };
  for (const t of [db.pages, db.memos, db.audio, db.userLines, db.wordStats, db.settings]) {
    t.hook('creating', () => void soon());
    t.hook('updating', () => void soon());
    t.hook('deleting', () => void soon());
  }
  window.addEventListener('online', now);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') now();
  });
  // A run cut off by closing the app leaves "running" behind; start clean.
  void getState().then((s) => (s.status === 'running' ? patchState({ status: 'idle' }) : s)).then(() => window.setTimeout(now, 2000));
}

// ---------- React ----------

export interface DropboxView {
  connected: boolean;
  accountName: string | null;
  state: SyncState;
}

export function useDropbox(): DropboxView | undefined {
  return useLiveQuery(async () => {
    const auth = await getRow<Auth>(KEY.auth);
    return { connected: auth !== null, accountName: auth?.accountName ?? null, state: await getState() };
  });
}
