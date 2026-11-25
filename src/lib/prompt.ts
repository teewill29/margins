// A page's exercise prompt as one line of text, for Notebook cards when the pad is still empty.
import { renderCharacter, type Character } from './character';

export function promptOf(exercise: string, state: unknown): string | null {
  const s = (state ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === 'string' && s[k] ? (s[k] as string) : null);
  switch (exercise) {
    case 'object':
      return str('object');
    case 'title':
      return str('title');
    case 'firstLine':
    case 'lastLine':
      return str('line');
    case 'character':
      return str('name') ? renderCharacter(s as unknown as Character) : null;
    case 'dice':
      return str('place') ? `${str('pov')}, ${str('tense')?.toLowerCase()}, ${str('place')}. No "${str('banned')}".` : null;
    case 'grid':
    case 'ladder': {
      const words = [...((s.words as string[] | undefined) ?? []), ...((s.nouns as string[] | undefined) ?? [])];
      return words.length ? words.slice(0, 5).join(', ') : null;
    }
    case 'cutup':
      return str('source')?.split('\n')[0]?.slice(0, 80) ?? null;
    default:
      return null;
  }
}
