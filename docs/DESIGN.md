# DESIGN

One look: a songwriter's notebook. Warm paper, blue rules, a red margin line, yellow highlighter, index cards held on with tape. The mockups in `design/mockups/` are the reference for layout, copy and styles. Match them.

## Tokens (`src/styles/tokens.css`)
```css
:root {
  --paper: #F3EEE3;        /* app background */
  --card: #FBF8F1;         /* index cards, pills, inputs */
  --ink: #24232A;          /* main text, icons */
  --ink-soft: #3E3C40;     /* card descriptions */
  --pencil: #6B6760;       /* secondary text (passes 4.5:1 on --paper) */
  --red: #B23A30;          /* red pencil: labels, counts, active tab, record button */
  --margin: #E08C86;       /* the margin line */
  --rule: #C9D6E3;         /* ruled lines */
  --marker: #F6E27F;       /* highlighter fill for used words */
  --marker-edge: #E3C94F;  /* border on highlighted grid cells */
  --dash: #B9AE96;         /* dashed border on unused grid cells and chips */
  --bar: #ECE5D6;          /* bottom bar */
  --bar-edge: #D8CDB6;     /* bottom bar top border, input borders */
  --tape: rgba(226, 214, 184, 0.85);
  --dock: #24232A;         /* recording dock background */
  --dock-edge: #5A5862;    /* dock button borders, idle meter bars */
  --rec: #E5574B;          /* recording dot and stop button */

  --font-serif: 'Fraunces', Georgia, serif;
  --font-type: 'Courier Prime', 'Courier New', monospace;
  --font-hand: 'Caveat', cursive;
  --font-ui: 'Inter', system-ui, sans-serif;

  --rule-gap: 30px;        /* the pad's line height; everything on the pad snaps to it */
  --margin-x: 52px;        /* the margin line's left offset */
  --radius-card: 4px;
  --shadow-card: 0 1px 0 rgba(36,35,42,0.06), 0 6px 18px rgba(80,60,30,0.10);
}
```

## Fonts
Self-hosted with `@fontsource` (works offline):
- **Fraunces** 500 and 600: screen titles, the object and title prompts
- **Courier Prime** 400 and 700: everything you write, grid words, page previews, timers
- **Caveat** 500 and 700: red-pencil labels (exercise names, "Use all 16", section labels, syllable counts, the "matched:" line)
- **Inter** 400, 500, 600: UI text, buttons, counts, metadata

## Type sizes
| use | font | size |
|---|---|---|
| Screen title (Notebook, Exercises) | Fraunces 600 | 32–34px, line-height 1.05 |
| Page top-bar title | Fraunces 600 | 19px |
| Object or title prompt | Fraunces 600 | 26px |
| Pad text | Courier Prime 400 | 14.5px on a 30px line |
| Grid words | Courier Prime | 12.5px (700 when used) |
| Red-pencil labels | Caveat 700 | 18–24px |
| UI body | Inter | 15px |
| Metadata | Inter | 12.5–13px, `--pencil` |

Inputs are 16px so iOS doesn't zoom.

## Components
- **IndexCard**: `--card` fill, `--radius-card`, `--shadow-card`, rotated between -0.6deg and 0.6deg. Exercise panels on a page carry a strip of tape (76×20px, `--tape`, slightly rotated, centered or offset left, half over the top edge). Picker and notebook cards have no tape. Pass the rotation in as a prop so it's stable per item, never random on each render.
- **RuledPad**: background `repeating-linear-gradient` with a 1px `--rule` line every `--rule-gap`, the margin line at `--margin-x` in `--margin`, text starting at `--margin-x + 10px`. The syllable count sits centered in the margin column in Caveat, `--red`. Everything on the pad (memo pills, section labels) takes exactly one 30px row.
- **WordCell**: 40px tall. Unused: `--paper` fill, 1px dashed `--dash`. Used: `--marker` fill, 1px solid `--marker-edge`, bold. Forced states add a small corner tick or cross drawn in `--red`.
- **Marker highlight** in the pad: `--marker` behind the word, 1px horizontal padding, 2px radius.
- **Chip**: 32–36px tall, pill. Idle: transparent, 1px dashed or solid `--dash`. Active: `--ink` fill with `--card` text (filters) or `--marker` fill (senses).
- **MemoPill**: 26px tall, 1px `--ink` border, `--card` fill, red play triangle, "0:38 · label" in Inter 12.5px.
- **BottomBar**: 92px with safe-area padding, `--bar`, top border `--bar-edge`. Three items: Notebook, Record, Exercises. Record is a 66px `--red` circle raised 22px above the bar with a paper-colored ring. Active tab label and icon in `--red`, weight 700.
- **RecordingDock**: replaces the bottom bar while recording. `--dock` fill, 16px top corners. Red dot + "Recording", elapsed time in Courier Prime, a level meter of about 40 bars (live from an AnalyserNode, `--marker` for recorded, `--dock-edge` for idle), then Discard, Stop (64px `--rec` circle with a white rounded square) and Pin to line.
- **Icons**: inline stroke SVG, 1.7–2px stroke, round caps. No emoji, no icon font.

## Motion
One motion only: a used word's marker highlight sweeps in left to right over 180ms. Turn it off under `prefers-reduced-motion`.

## Rules
- Design at 390px. It should still look right at 360px and on a desktop browser (center the app at 480px max width on wide screens, paper color filling the rest).
- Touch targets at least 44px.
- Respect `env(safe-area-inset-*)` at the top and bottom.
- No dark theme yet. Every color still goes through tokens so one can be added later.
- No em dashes in UI copy.
