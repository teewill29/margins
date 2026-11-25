# DATA MODEL

Dexie (IndexedDB), database name `margins`. Version 1 schema below. Every schema change gets a new Dexie version with a migration; never drop user data.

IDs are `crypto.randomUUID()`. Timestamps are epoch milliseconds. Calendar dates are local `YYYY-MM-DD` strings.

## Tables

### `pages`
Indexes: `id, updatedAt, exercise, archived`
```ts
interface Page {
  id: string;
  createdAt: number;
  updatedAt: number;
  date: string;              // local YYYY-MM-DD the page was created
  title: string | null;      // null = show the date
  exercise: ExerciseType;    // 'grid' | 'ladder' | 'object' | 'cutup' | 'firstLine' | 'lastLine' | 'title' | 'dice' | 'character' | 'free'
  state: ExerciseState;      // per-exercise, below
  body: string;              // the pad text, plain text with \n
  level: 'exact' | 'root' | 'loose';
  showSyllables: boolean;    // default true, false for 'object' and 'cutup'
  panelCollapsed: boolean;
  activeMs: number;          // time spent with the page open and visible
  archived: boolean;
}
```

`ExerciseState` by type:
```ts
type Override = 'auto' | 'used' | 'unused';

interface GridState {
  seed: string; daily: boolean; difficulty: 'loose' | 'medium' | 'wild';
  world: string;
  words: string[];                    // 16, display order
  locked: string[];
  overrides: Record<string, Override>;
  swapsUsed: number; shuffles: number;
}
interface LadderState {
  seed: string; world: string;
  nouns: string[]; verbs: string[];   // 8 each
  pairs: string[];                    // "the porch confesses"
  overrides: Record<string, Override>;
  nounShuffles: number; verbShuffles: number;
}
interface ObjectState {
  object: string; senses: string[];   // checked senses
  timerMs: number; elapsedMs: number; running: boolean; startedAt: number | null;
}
interface CutupState { source: string; seed: string; rechops: number; usedFragments: number[] }
interface LineState { line: string; draws: number }           // firstLine, lastLine
interface TitleState { title: string; draws: number }
interface DiceState { pov: string; tense: string; place: string; banned: string }
interface CharacterState { name: string; age: number; job: string; want: string; obstacle: string }
type FreeState = Record<string, never>;
```

### `memos`
Indexes: `id, pageId, createdAt`
```ts
interface Memo {
  id: string;
  pageId: string;
  createdAt: number;
  label: string;             // "Memo 3" until renamed
  durationMs: number;
  mimeType: string;          // from MediaRecorder
  audio: ArrayBuffer;        // the recording's bytes. Not a Blob: iOS Safari often refuses Blobs in IndexedDB.
  blob?: Blob;               // legacy rows only (before 2026-11-25); read audio through memoBlob()
  pinnedLine: number | null; // line index in page.body
  pinnedText: string | null; // that line's text when pinned
  tags: string[];            // empty for now; reserved for tunings and keys later
}
```
Keeping a pin attached when lines move: on load and after edits, find the first line whose text equals `pinnedText`. If found, use its index (and save it). If not, keep `pinnedLine` if that line still exists, else unpin and show the memo in the unpinned list.

### `wordStats`
Indexes: `w`
```ts
interface WordStat {
  w: string;
  shown: number;   // times it appeared in a drawn grid or ladder
  used: number;    // times it ended a page counted as used
  swaps: number;   // times swapped out
  banned: boolean;
  favorite: boolean;
}
```
Missing row = all zeros, false.

### `userLines`
Indexes: `id, kind`
```ts
interface UserLine { id: string; kind: 'first' | 'last'; text: string; createdAt: number }
```

### `settings`
Key-value, one row per key. Indexes: `key`
| key | type | default |
|---|---|---|
| `difficulty` | `'loose' \| 'medium' \| 'wild'` | `'medium'` |
| `dailyGrid` | boolean | `false` |
| `level` | `'exact' \| 'root' \| 'loose'` | `'root'` |
| `objectTimerMin` | 5 \| 10 \| 15 | 10 |
| `lastBackupAt` | number \| null | null |
| `backupBannerDismissedAt` | number \| null | null |
| `recentLines` | string[] (last 20 shown) | [] |
| `recentTitles` | string[] (last 20 shown) | [] |
| `persistRequested` | boolean | false |

## Backup format
Zip file `margins-backup-YYYY-MM-DD.zip`:
- `margins.json`: `{ version: 1, exportedAt, pages, memos (without audio), wordStats, userLines, settings }`
- `audio/<memoId>.<ext>`: one file per memo. Extension from MIME type: webm → `.webm`, mp4 → `.m4a`.

Import merges by id. A row replaces the stored one only if its `updatedAt` (or `createdAt` for memos and user lines) is newer. Import never deletes anything.
