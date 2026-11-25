import { useEffect } from 'react';
import { addActiveMs } from '../db/pages';

const FLUSH_MS = 30_000;

/** Adds time to page.activeMs while the page is open and visible. */
export function useActiveTime(pageId: string | undefined) {
  useEffect(() => {
    if (!pageId) return;
    let since: number | null = document.visibilityState === 'visible' ? Date.now() : null;
    const commit = () => {
      if (since === null) return;
      const now = Date.now();
      void addActiveMs(pageId, now - since);
      since = now;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        commit();
        since = null;
      } else since = Date.now();
    };
    const tick = window.setInterval(commit, FLUSH_MS);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      commit();
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pageId]);
}
