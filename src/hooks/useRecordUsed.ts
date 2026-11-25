import { useEffect, useRef } from 'react';
import { recordUsed } from '../db/wordStats';
import type { WordResult } from '../lib/detect';

/** Counts the page's used exercise words in wordStats when the page is left or the app is hidden. */
export function useRecordUsed(pageId: string, results: readonly WordResult[], enabled: boolean) {
  const latest = useRef<string[]>([]);
  useEffect(() => {
    latest.current = results.filter((r) => r.used).map((r) => r.word);
  }, [results]);
  useEffect(() => {
    if (!enabled) return;
    const flush = () => void recordUsed(pageId, latest.current);
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [pageId, enabled]);
}
