import { TopBar } from '../components/TopBar';

export function Words() {
  return (
    <main className="screen screen--no-bar">
      <TopBar title="Word manager" back="/settings" backLabel="Back to settings" />
      <p className="placeholder">No banned or favorite words yet.</p>
    </main>
  );
}
