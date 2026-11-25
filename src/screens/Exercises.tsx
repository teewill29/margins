import { useNavigate } from 'react-router';
import { createPage } from '../db/pages';
import { EXERCISES, LIVE_EXERCISES, type ExerciseType } from '../lib/exercises';

// Stable tilt per card, never random per render (DESIGN.md).
const TILT = [-0.6, 0.5, 0.3, -0.4, 0.6, -0.3, -0.5, 0.4, 0.2, -0.6];

export function Exercises() {
  const navigate = useNavigate();
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
      <div className="exercise-grid">
        {EXERCISES.map((ex, i) => {
          const live = LIVE_EXERCISES.has(ex.type);
          return (
            <button
              key={ex.type}
              type="button"
              className="exercise-card"
              style={{ transform: `rotate(${TILT[i] ?? 0}deg)` }}
              disabled={!live}
              onClick={() => void start(ex.type)}
            >
              <span className="exercise-card__name">{ex.name}</span>
              <span className="exercise-card__desc">{ex.desc}</span>
              <span className="exercise-card__meta">{live ? 'Start' : 'Soon'}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
