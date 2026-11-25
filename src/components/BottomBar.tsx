import { NavLink, useMatch, useNavigate } from 'react-router';
import { createPage } from '../db/pages';
import { useRecorder } from '../state/recorder';
import { ExercisesIcon, MicIcon, NotebookIcon } from './Icons';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'bottom-bar__tab active' : 'bottom-bar__tab';

export function BottomBar() {
  const rec = useRecorder();
  const onPage = useMatch('/page/:id');
  const navigate = useNavigate();

  const record = async () => {
    const pageId = onPage?.params.id;
    if (pageId) {
      void rec.start(pageId);
      return;
    }
    // Off a page: record onto a new free page, created once the mic is live.
    const id = crypto.randomUUID();
    if (await rec.start(id)) {
      await createPage('free', id);
      navigate(`/page/${id}`);
    }
  };

  return (
    <nav className="bottom-bar" aria-label="Main">
      <NavLink to="/" end className={tabClass}>
        <NotebookIcon />
        Notebook
      </NavLink>
      <button type="button" className="bottom-bar__record" aria-label="Record a voice memo" onClick={() => void record()}>
        <MicIcon size={26} />
      </button>
      <NavLink to="/exercises" className={tabClass}>
        <ExercisesIcon />
        Exercises
      </NavLink>
    </nav>
  );
}
