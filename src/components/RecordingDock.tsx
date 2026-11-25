import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../lib/format';
import { useRecorder } from '../state/recorder';

const BARS = 40;
const SAMPLE_MS = 120;

export function RecordingDock() {
  const rec = useRecorder();
  const [now, setNow] = useState(() => Date.now());
  const [levels, setLevels] = useState<number[]>([]);
  const acc = useRef({ peak: 0, last: 0 });
  const { level, status } = rec;

  useEffect(() => {
    if (status !== 'recording') return;
    let raf = 0;
    const loop = (t: number) => {
      acc.current.peak = Math.max(acc.current.peak, level());
      if (t - acc.current.last >= SAMPLE_MS) {
        const peak = acc.current.peak;
        acc.current = { peak: 0, last: t };
        setLevels((l) => [...l, peak].slice(-BARS));
        setNow(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [level, status]);

  const recording = status === 'recording';
  const elapsed = recording ? now - rec.startedAt : 0;

  return (
    <section className="dock" aria-label="Recording">
      <div className="dock__head">
        <span className="dock__state">
          <span className={recording ? 'dock__dot' : 'dock__dot dock__dot--wait'} aria-hidden="true" />
          {recording ? 'Recording' : 'Starting mic'}
        </span>
        <span className="dock__time" role="timer">
          {formatDuration(elapsed)}
        </span>
      </div>
      <div className="dock__meter" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => {
          const v = levels[i];
          return (
            <span
              key={i}
              className={v === undefined ? 'dock__bar' : 'dock__bar dock__bar--on'}
              style={{ height: v === undefined ? 4 : 4 + Math.round(v * 36) }}
            />
          );
        })}
      </div>
      <div className="dock__controls">
        <button type="button" className="dock__btn" onClick={() => void rec.discard()}>
          Discard
        </button>
        <button
          type="button"
          className="dock__stop"
          aria-label="Stop and save recording"
          disabled={!recording}
          onClick={() => void rec.stop()}
        >
          <span />
        </button>
        <button
          type="button"
          className={rec.pin ? 'dock__btn dock__btn--pinned' : 'dock__btn'}
          aria-pressed={rec.pin !== null}
          // Keep the pad focused so the caret line is still there.
          onPointerDown={(e) => e.preventDefault()}
          onClick={rec.togglePin}
        >
          {rec.pin ? `Pinned: line ${rec.pin.line + 1}` : 'Pin to line'}
        </button>
      </div>
    </section>
  );
}
