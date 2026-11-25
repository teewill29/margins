import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { audioBlob } from '../db/memos';
import type { Memo } from '../db/types';

/**
 * Object URLs for these memos' audio, made ahead of time. iOS only plays audio started directly
 * from a tap, so a tap can't wait on the database first. URLs live until the caller unmounts.
 */
export function useAudioUrls(memoIds: readonly string[]): ReadonlyMap<string, string> {
  const key = memoIds.join(',');
  const rows = useLiveQuery(() => db.audio.bulkGet(key ? key.split(',') : []), [key]);
  const cache = useRef(new Map<string, string>());
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    if (!rows) return;
    let added = false;
    for (const row of rows) {
      if (row && !cache.current.has(row.id)) {
        cache.current.set(row.id, URL.createObjectURL(audioBlob(row)));
        added = true;
      }
    }
    if (added) setUrls(new Map(cache.current));
  }, [rows]);
  useEffect(() => {
    const c = cache.current;
    return () => {
      for (const u of c.values()) URL.revokeObjectURL(u);
      c.clear();
    };
  }, []);
  return urls;
}

interface PlayerValue {
  playingId: string | null;
  /** `url` from useAudioUrls. */
  toggle(memo: Memo, url: string | undefined): void;
  stop(): void;
}

const PlayerContext = createContext<PlayerValue>({ playingId: null, toggle: () => {}, stop: () => {} });

export function usePlayer() {
  return useContext(PlayerContext);
}

/** One memo plays at a time, through a single audio element. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const currentId = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    setPlayingId(null);
  }, []);

  const toggle = useCallback((memo: Memo, url: string | undefined) => {
    if (!url) return;
    if (!audio.current) {
      const el = new Audio();
      el.addEventListener('ended', () => setPlayingId(null));
      el.addEventListener('pause', () => setPlayingId(null));
      el.addEventListener('play', () => setPlayingId(currentId.current));
      audio.current = el;
    }
    const el = audio.current;
    if (currentId.current === memo.id && el.src === url) {
      if (el.paused) void el.play().catch(() => setPlayingId(null));
      else el.pause();
      return;
    }
    el.pause();
    currentId.current = memo.id;
    el.src = url;
    void el.play().catch(() => setPlayingId(null));
  }, []);

  useEffect(() => () => audio.current?.pause(), []);

  const value = useMemo(() => ({ playingId, toggle, stop }), [playingId, toggle, stop]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
