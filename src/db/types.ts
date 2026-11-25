// Tables and fields from docs/DATA_MODEL.md.
import type { ExerciseType } from '../lib/exercises';

export type { ExerciseType };
export type Level = 'exact' | 'root' | 'loose';
export type Difficulty = 'loose' | 'medium' | 'wild';
export type Override = 'auto' | 'used' | 'unused';

export interface GridState {
  seed: string; daily: boolean; difficulty: Difficulty;
  world: string;
  words: string[];
  locked: string[];
  overrides: Record<string, Override>;
  swapsUsed: number; shuffles: number;
}
export interface LadderState {
  seed: string; world: string;
  nouns: string[]; verbs: string[];
  pairs: string[];
  overrides: Record<string, Override>;
  nounShuffles: number; verbShuffles: number;
}
export interface ObjectState {
  object: string; senses: string[];
  timerMs: number; elapsedMs: number; running: boolean; startedAt: number | null;
}
export interface CutupState { source: string; seed: string; rechops: number; usedFragments: number[] }
export interface LineState { line: string; draws: number }
export interface TitleState { title: string; draws: number }
export interface DiceState { pov: string; tense: string; place: string; banned: string }
export interface CharacterState { name: string; age: number; job: string; want: string; obstacle: string }
export type FreeState = Record<string, never>;

export type ExerciseState =
  | GridState | LadderState | ObjectState | CutupState | LineState
  | TitleState | DiceState | CharacterState | FreeState;

export interface Page {
  id: string;
  createdAt: number;
  updatedAt: number;
  date: string;
  title: string | null;
  exercise: ExerciseType;
  state: ExerciseState;
  body: string;
  level: Level;
  showSyllables: boolean;
  panelCollapsed: boolean;
  activeMs: number;
  archived: boolean;
}

export interface Memo {
  id: string;
  pageId: string;
  createdAt: number;
  label: string;
  durationMs: number;
  mimeType: string;
  /** The recording's bytes. Stored as an ArrayBuffer because iOS Safari often refuses Blobs in IndexedDB. */
  audio?: ArrayBuffer;
  /** Older rows (before 2026-11-25) hold a Blob here instead. Read audio through memoBlob(). */
  blob?: Blob;
  pinnedLine: number | null;
  pinnedText: string | null;
  tags: string[];
}

export interface WordStat {
  w: string;
  shown: number;
  used: number;
  swaps: number;
  banned: boolean;
  favorite: boolean;
}

export interface UserLine { id: string; kind: 'first' | 'last'; text: string; createdAt: number }

export interface Settings {
  difficulty: Difficulty;
  dailyGrid: boolean;
  level: Level;
  objectTimerMin: 5 | 10 | 15;
  lastBackupAt: number | null;
  backupBannerDismissedAt: number | null;
  recentLines: string[];
  recentTitles: string[];
  persistRequested: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'medium',
  dailyGrid: false,
  level: 'root',
  objectTimerMin: 10,
  lastBackupAt: null,
  backupBannerDismissedAt: null,
  recentLines: [],
  recentTitles: [],
  persistRequested: false,
};

export interface SettingRow<K extends keyof Settings = keyof Settings> {
  key: K;
  value: Settings[K];
}
