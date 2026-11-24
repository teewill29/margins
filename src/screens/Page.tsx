import { useParams } from 'react-router';
import { MoreIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { pageTitleDate, localDate } from '../lib/date';

export function Page() {
  const { id } = useParams();
  return (
    <main className="screen">
      <TopBar
        title={pageTitleDate(localDate())}
        sub="Free page"
        back="/"
        backLabel="Back to notebook"
        action={
          <button type="button" className="icon-btn" aria-label="Page options">
            <MoreIcon />
          </button>
        }
      />
      <p className="placeholder">Page {id} is empty for now.</p>
    </main>
  );
}
