import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TopBar } from '../components/TopBar';
import { finishRedirect } from '../sync/dropbox';
import { useToast } from '../state/toast';

/** Dropbox sends the user back here after sign-in. */
export function DropboxAuth() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const params = new URLSearchParams(location.search);
    finishRedirect(params).then(
      () => {
        toast({ text: 'Dropbox connected' });
        navigate('/settings', { replace: true });
      },
      (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't connect to Dropbox."),
    );
  }, [navigate, toast]);

  return (
    <main className="screen screen--no-bar">
      <TopBar title="Dropbox" back="/settings" backLabel="Back to settings" />
      {error ? (
        <div className="placeholder">
          <p>{error}</p>
          <Link to="/settings" className="btn">
            Back to settings
          </Link>
        </div>
      ) : (
        <p className="placeholder">Connecting…</p>
      )}
    </main>
  );
}
