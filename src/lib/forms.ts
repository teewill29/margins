// formsOf (DETECTION.md section 3): every form of a word, generated forward from the word.
// Used by `npm run bank` (forms are stored in words.json) and by tests. The app itself reads
// the stored forms, so `compromise` never ships to the phone.
import nlp from 'compromise';
import { IRREGULAR_PLURALS, IRREGULAR_VERBS } from './irregulars';

export type FormPos = 'noun' | 'verb' | 'texture' | 'place' | 'abstract';

const CVC = /[^aeiou][aeiou][bcdfghjklmnpqrstvz]$/;
const oneSyllable = (w: string) => (w.match(/[aeiouy]+/g) ?? []).length === 1;

function plural(w: string): string {
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

function singulars(w: string): string[] {
  if (/[^aeiou]ies$/.test(w)) return [`${w.slice(0, -3)}y`];
  if (/(ss|x|z|ch|sh)es$/.test(w)) return [w.slice(0, -2)];
  if (/[^s]s$/.test(w)) return [w.slice(0, -1)];
  return [];
}

/** Doubled and/or plain stem before -ed, -ing, -er, -est. */
function stems(w: string): string[] {
  if (CVC.test(w)) {
    const doubled = w + w.slice(-1);
    if (oneSyllable(w)) return [doubled];
    if (w.endsWith('l')) return [doubled, w]; // travelled, traveled
  }
  return [w];
}

function regularVerbForms(w: string): string[] {
  const out = [plural(w)];
  if (w.endsWith('e')) out.push(`${w}d`);
  else if (/[^aeiou]y$/.test(w)) out.push(`${w.slice(0, -1)}ied`);
  else out.push(...stems(w).map((s) => `${s}ed`));
  if (w.endsWith('ie')) out.push(`${w.slice(0, -2)}ying`);
  else if (/[^eoy]e$/.test(w)) out.push(`${w.slice(0, -1)}ing`);
  else out.push(...stems(w).map((s) => `${s}ing`));
  return out;
}

function adjectiveForms(w: string): string[] {
  if (w.endsWith('e')) return [`${w}r`, `${w}st`];
  if (/[^aeiou]y$/.test(w)) return [`${w.slice(0, -1)}ier`, `${w.slice(0, -1)}iest`];
  return stems(w).flatMap((s) => [`${s}er`, `${s}est`]);
}

const single = (s: string | undefined) => (s && /^[a-z'-]+$/.test(s) ? [s] : []);

/** All forms of `word`, including itself. `pos` limits irregular verb rows for non-verbs. */
export function formsOf(word: string, pos?: FormPos): Set<string> {
  const w = word.trim().toLowerCase();
  const out = new Set<string>([w]);
  if (!/^[a-z'-]+$/.test(w)) return out;

  // compromise first, then the spelling rules fill anything it missed.
  const asNoun = nlp(w);
  asNoun.tag('Noun');
  const asNoun2 = nlp(w);
  asNoun2.tag('Noun');
  for (const f of [asNoun.nouns().toPlural().text(), asNoun2.nouns().toSingular().text()]) single(f.toLowerCase()).forEach((x) => out.add(x));
  const asVerb = nlp(w);
  asVerb.tag('Verb');
  const conj = asVerb.verbs().conjugate()[0] as Record<string, string> | undefined;
  if (conj) for (const v of Object.values(conj)) single(v.toLowerCase()).forEach((x) => out.add(x));

  out.add(plural(w));
  singulars(w).forEach((x) => out.add(x));
  regularVerbForms(w).forEach((x) => out.add(x));
  if (pos === 'texture') adjectiveForms(w).forEach((x) => out.add(x));

  // Irregular verbs: both directions for verbs (and unknown pos). For other parts of speech only
  // when the word is the base, so the noun "saw" doesn't pick up "see".
  for (const row of IRREGULAR_VERBS) {
    if (pos && pos !== 'verb' ? row[0] === w : row.includes(w)) row.forEach((x) => out.add(x));
  }
  for (const row of IRREGULAR_PLURALS) if (row.includes(w)) row.forEach((x) => out.add(x));
  return out;
}

/** Two words share a root if either is among the other's forms (WORDS.md uses this). */
export function rootOf(a: string, b: string, posA?: FormPos, posB?: FormPos): boolean {
  return formsOf(a, posA).has(b.toLowerCase()) || formsOf(b, posB).has(a.toLowerCase());
}
