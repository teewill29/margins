// Word ladder pairs: "the porch confesses", "the headlights confess".

const IRREGULAR_THIRD: Readonly<Record<string, string>> = { be: 'is', have: 'has', do: 'does', go: 'goes' };

/** He/she/it form of a verb: confess -> confesses, bury -> buries, idle -> idles. */
export function thirdPerson(verb: string): string {
  if (IRREGULAR_THIRD[verb]) return IRREGULAR_THIRD[verb] as string;
  if (/(s|x|z|ch|sh|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

/** True for a plural noun like "headlights" (its forms include the singular). */
export function isPluralNoun(noun: string, forms: readonly string[]): boolean {
  if (!noun.endsWith('s') || noun.endsWith('ss')) return false;
  return forms.includes(noun.slice(0, -1)) || (noun.endsWith('es') && forms.includes(noun.slice(0, -2)));
}

export function pairPhrase(noun: string, nounForms: readonly string[], verb: string): string {
  return `the ${noun} ${isPluralNoun(noun, nounForms) ? verb : thirdPerson(verb)}`;
}
