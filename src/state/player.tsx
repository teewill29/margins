import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { memoBlob } from '../db/memos';
import type { Memo } from '../db/types';

interface PlayerValue {
  playingId: string | null;
  toggle(memo: Memo): void;
  stop(): void;
}

const PlayerContext = createContext<PlayerValue>({ playingId: null, toggle: () => {}, stop: () => {} });

export function usePlayer() {
  return useContext(PlayerContext);
}

/** One memo plays at a time, through a single audio element. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const currentId = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const release = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };

  const stop = useCallback(() => {
    audio.current?.pause();
    setPlayingId(null);
  }, []);

  const toggle = useCallback((memo: Memo) => {
    if (!audio.current) {
      const el = new Audio();
      el.addEventListener('ended', () => setPlayingId(null));
      el.addEventListener('pause', () => setPlayingId(null));
      el.addEventListener('play', () => setPlayingId(currentId.current));
      audio.current = el;
    }
    const el = audio.current;
    if (currentId.current === memo.id && url.current) {
      if (el.paused) void el.play().catch(() => setPlayingId(null));
      else el.pause();
      return;
    }
    el.pause();
    release();
    url.current = URL.createObjectURL(memoBlob(memo));
    currentId.current = memo.id;
    el.src = url.current;
    void el.play().catch(() => setPlayingId(null));
  }, []);

  useEffect(
    () => () => {
      audio.current?.pause();
      release();
    },
    [],
  );

  const value = useMemo(() => ({ playingId, toggle, stop }), [playingId, toggle, stop]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
