// Pad text helpers. The body is plain text with \n line breaks.

const LABEL = /^\s*\[([^\]\n]+)\]\s*$/;

export function splitLines(body: string): string[] {
  return body.split('\n');
}

/** A line wrapped in square brackets, like "[Verse 1]". */
export function isLabelLine(line: string): boolean {
  return LABEL.test(line);
}

/** "[Verse 1]" -> "Verse 1". Null if the line isn't a label. */
export function labelText(line: string): string | null {
  const m = LABEL.exec(line);
  return m?.[1] ? m[1].trim() : null;
}

/** Index of the line that contains character offset `offset`. */
export function lineAt(body: string, offset: number): number {
  let n = 0;
  const end = Math.min(offset, body.length);
  for (let i = 0; i < end; i++) if (body.charCodeAt(i) === 10) n++;
  return n;
}

/** The first `count` lines that have words and aren't labels, trimmed. Used for notebook cards. */
export function previewLines(body: string, count = 2): string[] {
  const out: string[] = [];
  for (const line of splitLines(body)) {
    const t = line.trim();
    if (!t || isLabelLine(t)) continue;
    out.push(t);
    if (out.length === count) break;
  }
  return out;
}
