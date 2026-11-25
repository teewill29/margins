// Syllable counts for the pad's margin (DETECTION.md section 7).
import { syllable } from 'syllable';
import FIXES from '../data/syllableFixes.json';
import { normalizeToken } from './detect';
import { isLabelLine } from './pad';
import { SYLLABLE_OVERRIDES } from './syllableOverrides';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n: number): string {
  if (n < 20) return ONES[n] as string;
  const t = TENS[Math.floor(n / 10)] as string;
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${under100(rest)}` : ''}`;
}

/** Numbers up to 9,999 as sung: 1999 is "nineteen ninety-nine", 2005 is "two thousand five". */
export function numberToWords(n: number): string {
  if (n < 1000) return under1000(n);
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (hi % 10 !== 0) {
    if (lo === 0) return `${under100(hi)} hundred`;
    return `${under100(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : under100(lo)}`;
  }
  const rest = n % 1000;
  return `${ONES[Math.floor(n / 1000)]} thousand${rest ? ` ${under1000(rest)}` : ''}`;
}

const CMU_FIXES = FIXES as Readonly<Record<string, number>>;

/** Hand-set overrides first, then CMU counts for bank words the package gets wrong, then the package. */
function countWord(w: string): number {
  return SYLLABLE_OVERRIDES[w] ?? CMU_FIXES[w] ?? syllable(w);
}

function countPiece(piece: string): number {
  let n = 0;
  for (const run of piece.match(/\d+|[^\d]+/g) ?? []) {
    if (/^\d+$/.test(run)) {
      const num = Number(run);
      const spoken = run.length <= 4 ? numberToWords(num) : [...run].map((d) => ONES[Number(d)]).join(' ');
      for (const part of spoken.split(/[\s-]+/)) n += countWord(part);
    } else if (/[a-z]/.test(run)) {
      n += countWord(run.replace(/^'+|'+$/g, ''));
    }
  }
  return n;
}

const cache = new Map<string, number | null>();

/** Syllables in one line of the pad, or null for labels and lines without words. */
export function countLine(line: string): number | null {
  const hit = cache.get(line);
  if (hit !== undefined) return hit;
  let result: number | null = null;
  if (line.trim() && !isLabelLine(line)) {
    let total = 0;
    let words = 0;
    for (const raw of line.split(/\s+/)) {
      const { norm } = normalizeToken(raw);
      if (!norm) continue;
      words++;
      for (const part of norm.split('-')) if (part) total += countPiece(part);
    }
    result = words ? total : null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(line, result);
  return result;
}
