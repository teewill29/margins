import { Link } from 'react-router';
import { GearIcon, PlusIcon } from '../components/Icons';

export function Notebook() {
  return (
    <main className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Margins</h1>
          <p className="screen-sub">0 pages · 0 memos</p>
        </div>
        <div className="screen-head__actions">
          <Link to="/settings" className="icon-btn" aria-label="Settings">
            <GearIcon />
          </Link>
          <Link to="/exercises" className="round-btn" aria-label="New page">
            <PlusIcon />
          </Link>
        </div>
      </header>
    </main>
  );
}
