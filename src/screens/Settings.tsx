import { Link } from 'react-router';
import { ChevronIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';

export function Settings() {
  return (
    <main className="screen screen--no-bar">
      <TopBar title="Settings" back="/" backLabel="Back to notebook" />
      <Link to="/words" className="list-row">
        Word manager
        <ChevronIcon />
      </Link>
    </main>
  );
}
