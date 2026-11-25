export type ExerciseType =
  | 'grid'
  | 'ladder'
  | 'object'
  | 'cutup'
  | 'firstLine'
  | 'lastLine'
  | 'title'
  | 'dice'
  | 'character'
  | 'free';

export interface ExerciseInfo {
  type: ExerciseType;
  name: string;
  desc: string;
}

/** Picker order and card copy (SPEC.md). */
export const EXERCISES: readonly ExerciseInfo[] = [
  { type: 'grid', name: 'Word grid', desc: '16 words. Use every one.' },
  { type: 'ladder', name: 'Word ladder', desc: 'Nouns meet verbs. Pair the odd ones.' },
  { type: 'object', name: 'Object writing', desc: 'One object, seven senses, ten minutes.' },
  { type: 'cutup', name: 'Cut-up', desc: 'Paste a text. Chop it. Rearrange.' },
  { type: 'firstLine', name: 'First line', desc: "Start from a line you didn't write." },
  { type: 'lastLine', name: 'Last line', desc: 'Write toward an ending.' },
  { type: 'title', name: 'Title first', desc: 'Earn the title by the chorus.' },
  { type: 'dice', name: 'Constraint dice', desc: 'POV, tense, place, one banned word.' },
  { type: 'character', name: 'Character', desc: 'A person, a want, an obstacle.' },
  { type: 'free', name: 'Free page', desc: 'No prompt. Just write.' },
];

/** Exercises that can start a page right now. Grows phase by phase. */
export const LIVE_EXERCISES: ReadonlySet<ExerciseType> = new Set(['grid', 'free']);

export function exerciseName(type: ExerciseType): string {
  return EXERCISES.find((e) => e.type === type)?.name ?? type;
}
