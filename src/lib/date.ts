// Calendar dates are local YYYY-MM-DD strings. Never derive a day from UTC.

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of `d` as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as local midnight (not UTC, which `new Date('YYYY-MM-DD')` would do). */
export function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 24" */
export function shortDate(s: string): string {
  const d = parseLocalDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Tuesday, Nov 24": the page title when a page has no name. */
export function pageTitleDate(s: string): string {
  const d = parseLocalDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${shortDate(s)}`;
}

/** Whole calendar days from `a` to `b` (both YYYY-MM-DD). DST-safe. */
export function daysBetween(a: string, b: string): number {
  const [da, db] = [parseLocalDate(a), parseLocalDate(b)];
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** "Today", "Yesterday", else "Nov 21". */
export function relativeDay(s: string, today: string = localDate()): string {
  const diff = daysBetween(s, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return shortDate(s);
}
