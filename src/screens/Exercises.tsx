import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { db } from '../db/db';
import { createPage } from '../db/pages';
import { localDate, relativeDay } from '../lib/date';
import { EXERCISES, lastUsed, LIVE_EXERCISES, type ExerciseType } from '../lib/exercises';
import { pickSurprise } from '../lib/surprise';

// Stable tilt per card, never random per render (DESIGN.md).
const TILT = [-0.6, 0.5, 0.3, -0.4, 0.6, -0.3, -0.5, 0.4, 0.2, -0.6];

const lastLabel = (date: string | undefined) => {
  if (!date) return 'never tried';
  const r = relativeDay(date);
  return `last: ${r === 'Today' || r === 'Yesterday' ? r.toLowerCase() : r}`;
};

export function Exercises() {
  const navigate = useNavigate();
  // Archived pages count too: they were still used.
  const last = useLiveQuery(async () => lastUsed(await db.pages.toArray()));
  const live = EXERCISES.filter((e) => LIVE_EXERCISES.has(e.type)).map((e) => e.type);

  const start = async (type: ExerciseType) => {
    const page = await createPage(type);
    navigate(`/page/${page.id}`);
  };

  return (
    <main className="screen screen--exercises">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Exercises</h1>
          <p className="screen-sub">Pick one to start a new page.</p>
        </div>
      </header>
      <div className="surprise">
        <button
          type="button"
          className="btn surprise__btn"
          disabled={!last}
          onClick={() => last && void start(pickSurprise(live, last, localDate(), `surprise:${Date.now()}`))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          </svg>
          Surprise me
        </button>
      </div>
      <div className="exercise-grid">
        {EXERCISES.map((ex, i) => {
          const ok = LIVE_EXERCISES.has(ex.type);
          return (
            <button
              key={ex.type}
              type="button"
              className="exercise-card"
              style={{ transform: `rotate(${TILT[i] ?? 0}deg)` }}
              disabled={!ok}
              onClick={() => void start(ex.type)}
            >
              <span className="exercise-card__name">{ex.name}</span>
              <span className="exercise-card__desc">{ex.desc}</span>
              <span className="exercise-card__meta">{ok ? lastLabel(last?.get(ex.type)) : 'Soon'}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
