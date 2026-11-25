// Title first (SPEC.md): which title words count, and whether they've landed in the chorus.
import type { WordResult } from './detect';
import { isLabelLine, labelText } from './pad';

const STOPWORDS = new Set(
  'a an the of in on at to for and or but nor so as if by with from into onto up down out off over under about than then too very my your his her our their its me you him us them i we he she they it this that these those is are was were be been am do did has have had no not all every one'.split(' '),
);

/** The words of a title that must land in the chorus: lowercase, no stopwords or possessives. */
export function titleWords(title: string): string[] {
  const all = title
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^a-z'-]+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter(Boolean);
  const kept = all.filter((w) => !STOPWORDS.has(w));
  return [...new Set(kept.length ? kept : all)];
}

/** Line indexes under a label containing "chorus", up to the next label. */
export function chorusLines(body: string): Set<number> {
  const out = new Set<number>();
  let inChorus = false;
  body.split('\n').forEach((line, i) => {
    if (isLabelLine(line)) inChorus = /chorus/i.test(labelText(line) ?? '');
    else if (inChorus) out.add(i);
  });
  return out;
}

/** True once every title word has a match on a chorus line. */
export function titleInChorus(results: readonly WordResult[], chorus: ReadonlySet<number>): boolean {
  return results.length > 0 && results.every((r) => r.matches.some((m) => chorus.has(m.line)) || (r.source === 'override' && r.used));
}
