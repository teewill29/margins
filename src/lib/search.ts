// Notebook search: page text, exercise words, prompt text and memo labels.

/** State keys that hold machinery, not words the user sees. */
const SKIP_KEYS = new Set(['seed', 'world', 'difficulty', 'overrides', 'locked', 'usedFragments']);

function collectStrings(value: unknown, out: string[], key = ''): void {
  if (SKIP_KEYS.has(key)) return;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) collectStrings(v, out, k);
}

interface Searchable {
  body: string;
  title: string | null;
  state: unknown;
}

/** Everything a search should look through for one page, lowercased. */
export function searchText(page: Searchable, memoLabels: readonly string[]): string {
  const parts: string[] = [page.body];
  if (page.title) parts.push(page.title);
  collectStrings(page.state, parts);
  parts.push(...memoLabels);
  return parts.join('\n').toLowerCase();
}

/** Case-insensitive, matches anywhere. A blank query matches everything. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || haystack.includes(q);
}
