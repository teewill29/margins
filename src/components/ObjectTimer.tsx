import { useEffect, useRef, useState } from 'react';
import { playChime, unlockAudio } from '../audio/chime';
import { setPageState } from '../db/pages';
import type { ObjectState } from '../db/types';
import { formatDuration } from '../lib/format';

const R = 15;
const C = 2 * Math.PI * R;

const spoken = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m ? `${m} minute${m === 1 ? '' : 's'}` : ''}${m && rest ? ' ' : ''}${rest ? `${rest} second${rest === 1 ? '' : 's'}` : ''}` || '0 seconds';
};

/** Countdown in the top bar with a progress ring. Writing is never locked. */
export function ObjectTimer({ pageId, state }: { pageId: string; state: ObjectState }) {
  const [now, setNow] = useState(() => Date.now());
  const { running, startedAt, elapsedMs, timerMs } = state;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  const elapsed = elapsedMs + (running && startedAt ? Math.max(0, now - startedAt) : 0);
  const left = timerMs - elapsed;
  const over = left <= 0;

  // Chime once when the countdown crosses zero while this page is open.
  const prevLeft = useRef(left);
  useEffect(() => {
    if (running && prevLeft.current > 0 && left <= 0) {
      playChime();
      navigator.vibrate?.([200, 100, 200]);
    }
    prevLeft.current = left;
  }, [left, running]);

  const tap = () => {
    if (running) {
      void setPageState(pageId, { ...state, running: false, startedAt: null, elapsedMs: elapsed });
    } else {
      unlockAudio();
      void setPageState(pageId, { ...state, running: true, startedAt: Date.now() });
    }
  };

  const label = over
    ? `${running ? 'Pause' : 'Resume'} timer. Time is up, ${spoken(-left)} over`
    : `${running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'} timer, ${spoken(left)} left`;
  const progress = Math.min(1, elapsed / timerMs);

  return (
    <button type="button" className={running ? 'timer timer--running' : 'timer'} aria-label={label} onClick={tap}>
      <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} className="timer__track" />
        <circle cx="18" cy="18" r={R} className="timer__fill" strokeDasharray={`${progress * C} ${C}`} transform="rotate(-90 18 18)" />
      </svg>
      {over ? (
        <span className="timer__text">
          Time <span className="timer__over">{formatDuration(-left)}</span>
        </span>
      ) : (
        <span className="timer__text">{formatDuration(left + 999)}</span>
      )}
    </button>
  );
}
