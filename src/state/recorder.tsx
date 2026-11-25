import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { deliverFile } from '../db/backup';
import { saveMemo, type NewMemo } from '../db/memos';
import { extForMime } from '../lib/backup';
import { levelFromBytes, pickMimeType } from '../lib/media';
import type { Pin } from '../lib/pins';
import { isIOS } from '../platform';
import { activePad } from './padRegistry';
import { usePlayer } from './player';
import { useToast } from './toast';

export type RecStatus = 'idle' | 'starting' | 'recording';
export type RecError = 'denied' | 'unsupported' | 'failed';

interface RecorderValue {
  status: RecStatus;
  pageId: string | null;
  startedAt: number;
  pin: Pin | null;
  error: RecError | null;
  /** Recordings the database refused. Kept in memory until saved or handed out as a file. */
  unsaved: readonly NewMemo[];
  retryUnsaved(): Promise<void>;
  exportUnsaved(memo: NewMemo): Promise<void>;
  /** Resolves true once the mic is live. Call straight from a tap so iOS allows audio. */
  start(pageId: string): Promise<boolean>;
  stop(): Promise<void>;
  discard(): Promise<void>;
  togglePin(): void;
  /** Current loudness, 0..1. Cheap; call every frame. */
  level(): number;
  clearError(): void;
}

const RecorderContext = createContext<RecorderValue | null>(null);

export function useRecorder(): RecorderValue {
  const v = useContext(RecorderContext);
  if (!v) throw new Error('useRecorder outside RecorderProvider');
  return v;
}

interface Session {
  pageId: string;
  stream: MediaStream | null;
  rec: MediaRecorder | null;
  chunks: Blob[];
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  buf: Uint8Array<ArrayBuffer>;
  startedAt: number;
  mime: string;
  wake: WakeLockSentinel | null;
  cancelled: boolean;
}

function newAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function cleanup(s: Session) {
  s.stream?.getTracks().forEach((t) => t.stop());
  void s.ctx?.close().catch(() => {});
  void s.wake?.release().catch(() => {});
}

export function RecorderProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const player = usePlayer();
  const session = useRef<Session | null>(null);
  const pinRef = useRef<Pin | null>(null);
  const [status, setStatus] = useState<RecStatus>('idle');
  const [pageId, setPageId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [pin, setPinState] = useState<Pin | null>(null);
  const [error, setError] = useState<RecError | null>(null);
  const [unsaved, setUnsaved] = useState<NewMemo[]>([]);

  const setPin = useCallback((p: Pin | null) => {
    pinRef.current = p;
    setPinState(p);
  }, []);

  const reset = useCallback(() => {
    session.current = null;
    setStatus('idle');
    setPageId(null);
    setPin(null);
  }, [setPin]);

  const start = useCallback(
    async (id: string): Promise<boolean> => {
      if (session.current) return false;
      player.stop();
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('unsupported');
        return false;
      }
      const s: Session = {
        pageId: id, stream: null, rec: null, chunks: [], ctx: null, analyser: null,
        buf: new Uint8Array(new ArrayBuffer(512)), startedAt: 0, mime: '', wake: null, cancelled: false,
      };
      session.current = s;
      setPin(null);
      setPageId(id);
      setStatus('starting');
      try {
        // Raw sound suits instruments better than call-style processing, but iOS can return
        // quiet or silent input with processing off, so iPhone gets its normal mic.
        s.stream = await navigator.mediaDevices.getUserMedia({
          audio: isIOS() ? true : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (s.cancelled) {
          cleanup(s);
          return false;
        }
        s.mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
        s.rec = new MediaRecorder(s.stream, s.mime ? { mimeType: s.mime } : undefined);
        s.rec.ondataavailable = (e) => {
          if (e.data.size > 0) s.chunks.push(e.data);
        };
        s.rec.start(1000);
        // The meter's audio context starts after the mic: on iOS, turning the mic on can
        // suspend a context that was already running, which leaves the meter flat.
        // The meter is only a display; the recording doesn't depend on it.
        s.ctx = newAudioContext();
        if (s.ctx) {
          const ctx = s.ctx;
          s.analyser = ctx.createAnalyser();
          s.analyser.fftSize = 512;
          ctx.createMediaStreamSource(s.stream).connect(s.analyser);
          const wake = () => {
            if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
          };
          ctx.addEventListener('statechange', wake);
          wake();
        }
        navigator.wakeLock
          ?.request('screen')
          .then((w) => {
            if (session.current === s) s.wake = w;
            else void w.release();
          })
          .catch(() => {});
        s.startedAt = Date.now();
        setStartedAt(s.startedAt);
        setStatus('recording');
        return true;
      } catch (e) {
        cleanup(s);
        reset();
        const name = e instanceof DOMException ? e.name : '';
        setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
        return false;
      }
    },
    [player, reset, setPin],
  );

  /** Stops the mic and returns what was recorded, without saving it. */
  const finish = useCallback(async (): Promise<NewMemo | null> => {
    const s = session.current;
    if (!s) return null;
    s.cancelled = true;
    const rec = s.rec;
    if (!rec) {
      cleanup(s);
      reset();
      return null;
    }
    const durationMs = Date.now() - s.startedAt;
    await new Promise<void>((resolve) => {
      if (rec.state === 'inactive') return resolve();
      rec.addEventListener('stop', () => resolve(), { once: true });
      rec.stop();
    });
    cleanup(s);
    const mimeType = rec.mimeType || s.mime || 'audio/webm';
    const memo: NewMemo = { pageId: s.pageId, blob: new Blob(s.chunks, { type: mimeType }), mimeType, durationMs, pin: pinRef.current };
    reset();
    return memo.blob.size > 0 ? memo : null;
  }, [reset]);

  /**
   * Saves a recording, trying twice. If the database still refuses, the recording is never dropped:
   * it goes to `unsaved`, shown as a card with Try again and Save file until one of them works.
   */
  const trySave = async (memo: NewMemo): Promise<boolean> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const saved = await saveMemo(memo);
        toast({ text: `Saved ${saved.label}` });
        return true;
      } catch (e) {
        console.error('Saving memo failed', e);
      }
    }
    return false;
  };
  const trySaveRef = useRef(trySave);
  useEffect(() => {
    trySaveRef.current = trySave;
  });

  const save = useCallback(async (memo: NewMemo) => {
    if (!(await trySaveRef.current(memo))) setUnsaved((u) => [...u, memo]);
  }, []);

  const retryUnsaved = useCallback(async () => {
    const left: NewMemo[] = [];
    for (const m of unsaved) if (!(await trySaveRef.current(m))) left.push(m);
    setUnsaved(left);
  }, [unsaved]);

  const exportUnsaved = useCallback(async (memo: NewMemo) => {
    const name = `margins-memo-${new Date(Date.now() - memo.durationMs).toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${extForMime(memo.mimeType)}`;
    if (await deliverFile(new File([memo.blob], name, { type: memo.mimeType }))) setUnsaved((u) => u.filter((m) => m !== memo));
  }, []);

  const stop = useCallback(async () => {
    const memo = await finish();
    if (memo) await save(memo);
  }, [finish, save]);

  const discard = useCallback(async () => {
    const memo = await finish();
    if (memo) toast({ text: 'Recording discarded', action: { label: 'Undo', run: () => void save(memo) } });
  }, [finish, save, toast]);

  const togglePin = useCallback(() => {
    if (pinRef.current) return setPin(null);
    const pad = activePad();
    if (pad && pad.pageId === session.current?.pageId) setPin(pad.caret());
  }, [setPin]);

  const level = useCallback(() => {
    const s = session.current;
    if (!s?.analyser) return 0;
    s.analyser.getByteTimeDomainData(s.buf);
    return levelFromBytes(s.buf);
  }, []);

  // If the app is hidden mid-recording, save what we have: iOS cuts the mic anyway.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && session.current) void stop();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [stop]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<RecorderValue>(
    () => ({ status, pageId, startedAt, pin, error, unsaved, retryUnsaved, exportUnsaved, start, stop, discard, togglePin, level, clearError }),
    [status, pageId, startedAt, pin, error, unsaved, retryUnsaved, exportUnsaved, start, stop, discard, togglePin, level, clearError],
  );
  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}
