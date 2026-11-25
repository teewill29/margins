/** 38_000 -> "0:38", 725_000 -> "12:05" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 1 -> "1 page", 3 -> "3 pages" */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Whole minutes spent on a page, or null under a minute. */
export function activeMinutes(ms: number): string | null {
  const m = Math.floor(ms / 60_000);
  return m < 1 ? null : `${m} min`;
}

/** "just now", "5 min ago", "3 h ago", else "Nov 21". */
export function timeAgo(then: number, now: number, shortDate: (ms: number) => string): string {
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return shortDate(then);
}
