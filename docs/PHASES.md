# PHASES

Build in order. A phase is done only when every acceptance item passes. Then update the Commands section and the Progress log in `CLAUDE.md`.

## Phase 0: Scaffold
- Vite + React + TypeScript (strict), React Router, Dexie, vite-plugin-pwa, Vitest, ESLint.
- `tokens.css` from DESIGN.md, `@fontsource` fonts loaded.
- Empty routes for every screen in SPEC.md, each with its title.
- Bottom bar with working navigation.
- PWA manifest (name "Margins", paper-colored theme and background, a simple icon: a red margin line on a ruled page, made as SVG and exported to the PNG sizes the manifest needs).

**Done when**
- `npm run dev`, `npm run build`, `npm test` and `npm run lint` all work.
- Deployed on Vercel from the GitHub repo.
- Installs to the iPhone home screen and opens with no network.

## Phase 1: Notebook, free pages, memos, backup
- Dexie schema v1 (DATA_MODEL.md), all tables.
- Notebook list, search, archive with undo, empty state.
- Free page: ruled pad with the textarea-over-mirror setup, autosave, section labels, rename, copy lyrics.
- Voice memos: record, recording dock with live meter, stop, discard, pin to line, play, rename, delete with undo, unpinned list. Wake lock while recording. Mic-denied card.
- Settings: backup export and import, last backup date, the 7-day banner, `navigator.storage.persist()`.

**Done when**
- I can write a page, record two memos (one pinned), close the app, reopen it offline and everything is there.
- Moving lines around keeps a pinned memo on its line (DATA_MODEL.md rule).
- Export, clear site data, import: every page and memo comes back and the audio plays.
- Recording works in Safari on iPhone and in Chrome on desktop.

## Phase 2: Detection, syllables, word bank, word grid
- `src/lib/detect.ts`, `src/lib/syllables.ts`, `src/lib/random.ts`, `src/lib/draw.ts`, with every test from DETECTION.md and WORDS.md written first.
- Write the word bank source lists and `npm run bank` with its checks (WORDS.md sections 1 and 2).
- Pad: marker highlights, syllable counts in the margin.
- Word grid exercise: draw, count, overrides by tapping, "matched:" line, long-press sheet (swap, lock, ban, favorite), shuffle with confirm, difficulty, daily grid.
- Detection level in the ••• menu and Settings.
- Exercise picker with the grid live and the rest shown but marked "Soon".

**Done when**
- All DETECTION.md and WORDS.md tests pass.
- `npm run bank` passes its checks.
- Two phones on the same date get the same daily grid.
- Typing on a long page stays smooth on my phone (no visible lag).
- I've done 5 real grids and fewer than 1 word per grid felt unusable. If more did, tighten the bank before moving on.

## Phase 3: The other exercises
In this order, each one fully done before the next:
1. Object writing (with timer and chime)
2. Title first
3. First line and Last line (plus My lines in Settings)
4. Constraint dice
5. Character
6. Word ladder
7. Cut-up

Write each one's content bank (WORDS.md section 6) as part of its step, with `npm run bank` checks for counts and the cliché list.

Then: "Surprise me" weighting, "last: Nov 15" on picker cards, notebook filter chips per exercise.

**Done when**
- Every exercise in SPEC.md works as described.
- No bank line matches a real song lyric I can find with a web search (spot-check 20).

## Phase 4: Polish
- Word manager screen.
- Record `shown` and `used` word stats.
- Panel collapse per page.
- The marker sweep motion.
- Desktop layout (centered, 480px max).
- Accessibility pass: every control reachable by keyboard and labelled, contrast checked.

**Done when**
- I've used it for a week and the Open questions section in CLAUDE.md is empty or decided.

## Later (not now)
- Open tunings tool: chord shapes and drones for DADGAD, Open D, Open G and others, linked to pages and memo tags.
- Riff vault: tag memos by tuning, key and tempo, then search across them.
- Claude-generated themed grids (needs a paid API, so only if I decide it's worth it).
- Dark "night desk" theme.
