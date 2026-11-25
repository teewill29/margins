# SPEC

What every screen and feature does. Mockups: `design/mockups/`. Content rules for exercises: `WORDS.md`. Matching and syllables: `DETECTION.md`.

## Core idea
A **page** is one writing session. It has:
1. An **exercise** (or none, for a free page), shown in a panel at the top
2. A **writing pad**: ruled, with a syllable count per line in the left margin
3. **Voice memos**, recorded on the page and optionally pinned to a line

Everything on a page saves automatically as you go.

## Navigation
Bottom bar on the Notebook, Exercise picker and Page screens: Notebook (left), Record (center, raised red button), Exercises (right). The active tab is red.

Routes:
- `/` Notebook
- `/exercises` Exercise picker
- `/page/:id` Page
- `/settings` Settings (reached from a gear icon on the Notebook header)
- `/words` Word manager (reached from Settings)

## Notebook (`Notebook.dc.html`)
- Header: "Margins", a count line ("23 pages · 31 memos"), a gear icon for Settings, and a + button that opens the Exercise picker.
- Search box: searches page text, exercise words, prompt text and memo labels. Case-insensitive, matches anywhere in the text. Results update as you type.
- Filter chips in a horizontal scroll row: All, then one chip per exercise type that has at least one page. One active at a time.
- Page list, newest `updatedAt` first. Each card shows:
  - First non-empty, non-label line of the page in bold typewriter type (fallback: the prompt, for example "A motel ice bucket")
  - Second line in gray
  - Exercise tag in red handwriting, date ("Today", "Yesterday", else "Nov 21"), memo count with a mic icon
- Long-press or swipe left on a card: Archive. Archived pages leave the list and come back from Settings > Archived pages. Undo toast for 5 seconds.
- Empty state: one card that says "No pages yet. Pick an exercise or start a free page." with both buttons.

## Exercise picker (`Exercises.dc.html`)
- Header "Exercises", subline "Pick one to start a new page."
- "Surprise me" button: picks an exercise at random, weighting ones used least recently higher (weight = days since last used + 1, capped at 30; never used = 30).
- 2-column grid of index cards, one per exercise: name in red handwriting, one-line description, and "last: Nov 15" or "never tried".
- Tapping a card creates a new page with that exercise and opens it.

Exercises and their card copy:

| Type | Name | Description |
|---|---|---|
| `grid` | Word grid | 16 words. Use every one. |
| `ladder` | Word ladder | Nouns meet verbs. Pair the odd ones. |
| `object` | Object writing | One object, seven senses, ten minutes. |
| `cutup` | Cut-up | Paste a text. Chop it. Rearrange. |
| `firstLine` | First line | Start from a line you didn't write. |
| `lastLine` | Last line | Write toward an ending. |
| `title` | Title first | Earn the title by the chorus. |
| `dice` | Constraint dice | POV, tense, place, one banned word. |
| `character` | Character | A person, a want, an obstacle. |
| `free` | Free page | No prompt. Just write. |

## Page (`Main.dc.html`, `ObjectWriting.dc.html`)
Top bar: back arrow (to Notebook), date as the title ("Tuesday, Nov 24"), subline with exercise name and time spent on the page ("Word grid · 14 min", counting only time the page is open and visible), a ••• menu.

••• menu: Rename page, Detection level (Exact / Root / Loose), Copy lyrics, Archive page.

### Exercise panel
An index card with a strip of tape, tilted slightly. It can be collapsed to a single line by tapping its header, so the pad gets more room. Collapsed state is remembered per page. Each exercise's panel is defined below.

### Writing pad
- Ruled lines every 30px, red margin line, typewriter font (see DESIGN.md).
- Implementation: a `<textarea>` over a mirror `<div>` that renders the same text with highlight spans (the "highlight within textarea" technique). The textarea text is transparent with a visible caret; the mirror shows the text and highlights. Font, size, line-height, padding and wrapping must match exactly so highlights line up. Scroll positions stay in sync.
- Words that match an exercise word get the marker highlight (see DETECTION.md for what counts as a match).
- **Section labels**: a line wrapped in square brackets, like `[Verse 1]` or `[Chorus]`, renders in red handwriting with no brackets shown in the mirror, and gets no syllable count.
- **Syllable count** in the left margin for every line that has words (DETECTION.md). A wrapped line shows its count on its first visual row only.
- Autosave: 500 ms after typing stops, and on page hide.
- Undo and redo work as in any textarea.

### Voice memos
- The center Record button starts recording on the current page. On the Notebook or Exercise picker it creates a new free page first, then records on it.
- While recording, the bottom bar is replaced by the **recording dock** (see `ObjectWriting.dc.html`): red dot + "Recording", elapsed time, a live level meter (bars from an AnalyserNode), Discard, Stop (saves), and "Pin to line".
- "Pin to line" pins the memo to the line the caret is on when you tap it. Tapping again unpins. The button shows "Pinned: line 4" when pinned.
- After Stop, the memo saves with a default label "Memo 3" (counting memos on that page). Tap the label to rename it.
- A pinned memo shows as a small pill under its line ("▶ 0:38 · verse hum"). Tap to play or pause. Long-press for: Rename, Unpin, Delete (with undo toast).
- Unpinned memos are listed at the bottom of the pad under a "Memos" label, same pills.
- Only one memo plays at a time. Starting a recording stops playback.
- Recording uses MediaRecorder. Pick the first supported type from: `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`. Save the blob, MIME type and duration.
- Keep the screen awake while recording (Screen Wake Lock API where supported, silently skip where not).
- If mic permission is denied, show an inline card explaining how to allow it in browser settings. Never crash.

## Exercise panels

### Word grid (`grid`)
- 4×4 grid of words drawn per WORDS.md. Header: "Use all 16" in red handwriting, "11 of 16" count, Shuffle button.
- Matched words get the marker style. Tapping a word cycles its manual override: auto → forced used → forced unused → auto (DETECTION.md, Overrides). A forced state shows a small pencil tick or cross in the corner of the cell.
- Under the grid, one handwriting line listing changed-form matches: "matched: burned → burn · borrowed → borrow". Only words matched through a form other than the exact word.
- Long-press a word for a sheet: Swap this word (uses 1 of 3 swaps; shows "2 swaps left"), Lock, Ban forever, Favorite.
- Shuffle: redraws all unlocked words. Doesn't use swaps. Confirms first if any unlocked word is already used in the lyrics.
- Grid settings (gear on the card): Difficulty (Loose / Medium / Wild), Daily grid on or off. When Daily grid is on, the grid comes from the date seed, so anyone with the app gets the same 16 words that day; swaps and shuffles are turned off for that page and the header says "Daily grid · Nov 24".
- When all 16 are used: the count turns red and reads "16 of 16 · done". No confetti.

### Word ladder (`ladder`)
- Two columns: 8 concrete nouns on the left, 8 verbs on the right (WORDS.md).
- Tap a noun then a verb to make a pair; the pair is added to a "Pairs" list on the card ("the porch confesses"). Pairs can be dragged into the pad or inserted at the caret with a tap.
- Matching and highlighting work as in the grid, on all 16 words.
- Shuffle either column on its own.

### Object writing (`object`, `ObjectWriting.dc.html`)
- "Your object" label, the object in large serif type ("A motel ice bucket"), "New object" button.
- Seven sense chips: Sight, Sound, Smell, Taste, Touch, Body, Motion. Tapping toggles a check; this is manual only.
- Countdown timer in the top bar with a progress ring. Default 10 minutes (Settings). Tap to start, pause, resume. When it hits zero: one soft chime (Web Audio, generated, no audio file), vibrate if supported, timer shows "Time" and keeps counting up in gray. Writing is never locked.
- No syllable counts on this page type by default (it's prose). Toggle in the ••• menu.

### Cut-up (`cutup`)
- Step 1: "Paste a text" box: paste anything (an old lyric, a news story, a page of fiction). Or "Use a page" to pick one of your own pages.
- Step 2: the app chops it into fragments of 2 to 5 words, breaking at punctuation first, then at random word boundaries (seeded, so the same text and seed give the same fragments). Shown as paper scraps in a wrapping row.
- Tap scraps to send them to the pad at the caret, in tap order. Used scraps go gray. "Rechop" redoes the split with a new seed.
- No word detection on this page type (the words are yours).

### First line (`firstLine`) and Last line (`lastLine`)
- Shows one line in large typewriter type. First line: the pad starts with that line already in it. Last line: the line is shown pinned at the bottom of the card as "End here:".
- "Another" button draws a new line. Lines come from the bank plus any lines I've added (Settings > My lines).

### Title first (`title`)
- Shows a title in large serif type. The pad starts with `[Chorus]` as its first line.
- The title's words are tracked like grid words; the card shows "Title used in chorus" once all its non-stopword words appear in the lines under a `[Chorus]` label.

### Constraint dice (`dice`)
- Four dice in a row, each a small card: Point of view, Tense, Place, Banned word. Roll all, or tap one die to reroll it alone.
- The banned word is flagged in the pad with a red underline (not a marker highlight) wherever it appears in any form (Root matching).

### Character (`character`)
- One line built from the tables: "Dale, 58, works nights at a toll booth. Wants his daughter to call. Keeps missing her."
- Reroll all, or tap any part (name, age, job, want, obstacle) to reroll it alone.

### Free page (`free`)
- No exercise panel. Just the pad and memos.

## Settings
- Defaults: grid difficulty, Daily grid on or off, detection level, object timer length (5, 10, 15 minutes).
- My lines: add, edit and delete your own first and last lines.
- Word manager (`/words`): lists banned and favorite words with their swap counts; unban or unfavorite from here. Search box.
- Archived pages: restore or delete forever (confirm).
- Backup:
  - "Export backup" builds a zip with `margins.json` (every table except audio) and an `audio/` folder with one file per memo, named by memo id with the right extension. The file name is `margins-backup-YYYY-MM-DD.zip`. Download through a normal link (`URL.createObjectURL`), and use the share sheet on iOS where `navigator.share` with files is supported.
  - "Import backup" reads that zip and merges by id: newer `updatedAt` wins, nothing is deleted.
  - "Last backup: Nov 20". If it's been more than 7 days and there's at least one new page, the Notebook shows a dismissable banner: "Back up your notebook. Last backup 9 days ago."
- On first launch call `navigator.storage.persist()` to ask the browser not to evict data.
- Dropbox: see below.

## Dropbox backup (added 2026-11-25)
Automatic backup to the user's own Dropbox app folder. Backup only, not two-way sync. Setup and file layout: `DROPBOX.md`.
- Settings > Dropbox: Connect Dropbox (PKCE sign-in, redirect to `/auth/dropbox`; fallback: paste a code). When connected: account name, status ("Backed up 5 min ago", "Backing up…", "Offline", an error), Back up now, Restore from Dropbox, Disconnect.
- Each memo's audio uploads once and is never overwritten. `margins.json` is replaced after changes, but only over the copy this device last wrote. If Dropbox has a different copy, backups pause and Settings shows Merge with Dropbox. A dated snapshot uploads once a day; the newest 30 are kept. Nothing else is ever deleted from Dropbox.
- Runs on launch, on reconnect, when the app is hidden, and 45 seconds after a change.
- A Dropbox backup counts as a backup for the Notebook's 7-day banner.
- Tokens are stored on the device only and never exported.

## Out of scope for now
- Accounts, two-way sync, sharing. (The daily grid gives the band a shared prompt with no server. Dropbox backup is one-way.)
- Claude-generated grids (needs a paid API).
- Open tunings tool and riff tagging. Planned as a later add-on; keep the page and memo tables general enough that a memo can get tags later.
- Dark theme.
