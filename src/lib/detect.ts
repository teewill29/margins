// Word matching (DETECTION.md). Pure: no React, no database, no compromise.
// Each exercise word comes with its forms (precomputed in words.json, or from formsOf in tests).
import { isLabelLine } from './pad';

export type Level = 'exact' | 'root' | 'loose';
export type Override = 'auto' | 'used' | 'unused';

export interface DetectWord {
  w: string;
  forms: ReadonlySet<string>;
}

export function detectWord(w: string, forms: Iterable<string>): DetectWord {
  const word = w.toLowerCase();
  return { w: word, forms: new Set([word, ...[...forms].map((f) => f.toLowerCase())]) };
}

export interface Token {
  line: number;
  /** Offsets of the word in its line, without surrounding punctuation. */
  start: number;
  end: number;
  norm: string;
  /** Hyphenated parts, normalized; empty if the token has no hyphen. */
  parts: string[];
}

export interface Match {
  line: number;
  start: number;
  end: number;
  token: string;
  exact: boolean;
}

export interface WordResult {
  word: string;
  used: boolean;
  source: 'match' | 'override' | 'none';
  matches: Match[];
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** DETECTION.md section 1, for one whitespace-separated token. */
export function normalizeToken(raw: string): { norm: string; start: number; end: number } {
  const s = raw.toLowerCase().replace(/[’‘ʼ`]/g, "'").replace(/[“”]/g, '"');
  let a = 0;
  while (a < s.length && !WORD_CHAR.test(s[a] as string)) a++;
  let b = s.length;
  while (b > a && !WORD_CHAR.test(s[b - 1] as string)) b--;
  let core = s.slice(a, b);
  if (core.endsWith('in') && s[b] === "'") {
    core = `${core}g`; // runnin' -> running
    b++;
  }
  core = core.replace(/'s$/, '');
  return { norm: core, start: a, end: b };
}

const dropPossessive = (p: string) => p.replace(/'s$/, '').replace(/in'$/, 'ing');

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] as string;
    if (isLabelLine(line)) continue;
    for (const m of line.matchAll(/\S+/g)) {
      const { norm, start, end } = normalizeToken(m[0]);
      if (!norm) continue;
      const parts = norm.includes('-') ? norm.split('-').filter(Boolean).map(dropPossessive) : [];
      out.push({ line: li, start: (m.index ?? 0) + start, end: (m.index ?? 0) + end, norm, parts });
    }
  }
  return out;
}

const LOOSE_ENDINGS = ['y', 'ish', 'less', 'ful', 'ly', 'er', 'ness', 'like'];
const HAS_VOWEL = /[aeiouy]/;

/** Optimal string alignment distance is at most 1 (one edit or one adjacent swap). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // transposition
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Does this single normalized piece match word `d` at `level`? */
function pieceMatches(piece: string, d: DetectWord, level: Level): boolean {
  if (piece === d.w) return true;
  if (level === 'exact') return false;
  if (d.forms.has(piece)) return true;
  if (level === 'root') return false;
  const w = d.w;
  if (w.length >= 4) {
    for (const e of LOOSE_ENDINGS) if (piece === w + e) return true;
    // Closed compound: starts or ends with the word or a form, and the rest is a word-like piece.
    for (let i = 3; i <= piece.length - 3; i++) {
      const head = piece.slice(0, i);
      const tail = piece.slice(i);
      if (d.forms.has(head) && HAS_VOWEL.test(tail)) return true;
      if (d.forms.has(tail) && HAS_VOWEL.test(head)) return true;
    }
  }
  if (w.length >= 6) for (const f of d.forms) if (withinOneEdit(piece, f)) return true;
  return false;
}

/** DETECTION.md section 6. Forms are computed once per word by the caller, not per keystroke. */
export function detect(text: string, words: readonly DetectWord[], level: Level, overrides: Readonly<Record<string, Override>>): WordResult[] {
  const tokens = tokenize(text);
  return words.map((d) => {
    const override = overrides[d.w] ?? 'auto';
    if (override === 'unused') return { word: d.w, used: false, source: 'override', matches: [] };
    const matches: Match[] = [];
    for (const t of tokens) {
      const pieces = t.parts.length ? [t.norm, ...t.parts] : [t.norm];
      const hit = pieces.find((p) => pieceMatches(p, d, level));
      if (hit !== undefined) matches.push({ line: t.line, start: t.start, end: t.end, token: t.norm, exact: pieces.includes(d.w) });
    }
    if (override === 'used') return { word: d.w, used: true, source: 'override', matches };
    return { word: d.w, used: matches.length > 0, source: matches.length ? 'match' : 'none', matches };
  });
}

/** "burned → burn" pairs for the line under the grid: first changed-form match per word. */
export function changedForms(results: readonly WordResult[]): [token: string, word: string][] {
  const out: [string, string][] = [];
  for (const r of results) {
    if (!r.used) continue;
    const m = r.matches.find((x) => !x.exact);
    if (m && !r.matches.some((x) => x.exact)) out.push([m.token, r.word]);
  }
  return out;
}
