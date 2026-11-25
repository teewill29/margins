// Keeping a memo pinned to its line when lines move (DATA_MODEL.md).

export interface Pin {
  line: number;
  text: string;
}

/**
 * Where a pinned memo belongs in `lines` now.
 * 1. A line whose text equals the pinned text (ignoring surrounding spaces). If the text appears
 *    more than once, the copy nearest the old line wins, so a repeated chorus line keeps its own memo.
 * 2. Else the old line index, if that line still exists (the line itself was edited).
 * 3. Else null: unpin and show the memo in the unpinned list.
 * The returned text is the line's current text, so later moves keep tracking it.
 */
export function resolvePin(lines: readonly string[], pinnedLine: number | null, pinnedText: string | null): Pin | null {
  if (pinnedLine === null) return null;
  const want = pinnedText?.trim() ?? '';
  if (want) {
    let best = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.trim() !== want) continue;
      if (best === -1 || Math.abs(i - pinnedLine) < Math.abs(best - pinnedLine)) best = i;
    }
    if (best !== -1) return { line: best, text: lines[best] ?? '' };
  }
  if (pinnedLine >= 0 && pinnedLine < lines.length) return { line: pinnedLine, text: lines[pinnedLine] ?? '' };
  return null;
}
