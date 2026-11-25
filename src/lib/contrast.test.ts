// Every text color on every background the app pairs it with must pass WCAG AA (4.5:1).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`No hex token --${name}`);
  return m[1];
};

// [text, background, where]
const PAIRS: [string, string, string][] = [
  ['ink', 'paper', 'body text'],
  ['ink', 'card', 'cards, inputs'],
  ['ink-soft', 'card', 'card descriptions'],
  ['pencil', 'paper', 'secondary text'],
  ['pencil', 'card', 'secondary text on cards'],
  ['red', 'paper', 'labels, syllable counts'],
  ['red', 'card', 'card labels'],
  ['card', 'red', 'danger buttons, record icon'],
  ['card', 'ink', 'primary buttons, active chips'],
  ['ink', 'marker', 'used words'],
  ['ink', 'bar', 'bottom bar'],
  ['red', 'bar', 'active tab'],
  ['card', 'dock', 'recording dock, toasts'],
  ['marker', 'dock', 'toast actions'],
];

describe('token contrast (WCAG AA, 4.5:1)', () => {
  for (const [fg, bg, where] of PAIRS) {
    it(`--${fg} on --${bg} (${where})`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
