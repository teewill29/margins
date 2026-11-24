import { NavLink } from 'react-router';
import { ExercisesIcon, MicIcon, NotebookIcon } from './Icons';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'bottom-bar__tab active' : 'bottom-bar__tab';

export function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label="Main">
      <NavLink to="/" end className={tabClass}>
        <NotebookIcon />
        Notebook
      </NavLink>
      {/* Recording arrives in Phase 1. */}
      <button type="button" className="bottom-bar__record" aria-label="Record a voice memo">
        <MicIcon size={26} />
      </button>
      <NavLink to="/exercises" className={tabClass}>
        <ExercisesIcon />
        Exercises
      </NavLink>
    </nav>
  );
}
