import { TopBar } from '../components/TopBar';

export function NotFound() {
  return (
    <main className="screen screen--no-bar">
      <TopBar title="Not found" back="/" backLabel="Back to notebook" />
      <p className="placeholder">Nothing at this address.</p>
    </main>
  );
}
