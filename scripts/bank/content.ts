// npm run bank (part 2): builds the exercise banks in src/data/ from the lists in scripts/bank/
// and runs their checks (WORDS.md section 6). Fails (exit 1) if any check breaks.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLDS } from '../../src/lib/draw';
import { formsOf } from '../../src/lib/forms';
import { titleWords } from '../../src/lib/titles';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', 'src', 'data');
const errors: string[] = [];
const report: string[] = [];

const CLICHES = 'love heart baby tonight forever fire rain soul dream broken alone feel sky eyes night light world stars angel shine tears goodbye cry kiss hold touch crazy wild free rise fly fall lost home'.split(' ');
const CLICHE_FORMS = new Map<string, string>();
for (const c of CLICHES) for (const f of formsOf(c)) CLICHE_FORMS.set(f, c);
/** Concrete uses WORDS.md allows: "rain gutter is fine, rain alone isn't". */
const ALLOWED_PHRASES = new Set([
  'rain gutter', 'rain gauge', 'fire escape', 'fire drill', 'fire truck', 'fire ant', 'fire station', 'fire hydrant',
  'heart monitor', 'night shift', 'porch light', 'home plate', 'home run', 'light bulb', 'night light', 'night class',
  'fly swatter', 'fall semester', 'kiss cam', 'brake light', 'traffic light', 'pilot light', 'tail light', 'dome light',
  'stop light', 'night nurse', 'night manager',
]);

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^a-z'-]+/)
    .flatMap((w) => w.split('-'))
    .filter(Boolean);

/** The cliché a line uses outside an allowed phrase, if any. */
export function clicheIn(text: string): string | null {
  const ws = words(text);
  for (let i = 0; i < ws.length; i++) {
    const c = CLICHE_FORMS.get(ws[i] as string);
    if (!c) continue;
    const before = `${ws[i - 1]} ${ws[i]}`;
    const after = `${ws[i]} ${ws[i + 1]}`;
    if (ALLOWED_PHRASES.has(before) || ALLOWED_PHRASES.has(after)) continue;
    return c;
  }
  return null;
}

interface Item {
  text: string;
  worlds: string[];
  tags: Record<string, string>;
  at: string;
}

/**
 * Reads a list file: "## section" headers, one item per line, optional "| key=value" tags.
 * The section is a world id ("-" for none) unless `sectionKey` names a tag it should fill instead.
 */
function readList(file: string, sectionKey?: string): Item[] {
  const items: Item[] = [];
  let section: string | null = null;
  const path = join(here, file);
  if (!existsSync(path)) return items;
  readFileSync(path, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('# ')) return;
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      if (!sectionKey && section !== '-' && !(WORLDS as readonly string[]).includes(section)) errors.push(`${file}:${i + 1}: unknown world "${section}"`);
      return;
    }
    const [text = '', ...rest] = line.split('|').map((x) => x.trim());
    const tags: Record<string, string> = {};
    for (const kv of rest.join(' ').split(/\s+/).filter(Boolean)) {
      const [k, v] = kv.split('=');
      if (k && v) tags[k] = v;
    }
    if (sectionKey && section) tags[sectionKey] = section;
    items.push({ text, worlds: !sectionKey && section && section !== '-' ? [section] : [], tags, at: `${file}:${i + 1}` });
  });
  return items;
}

function checkCount(name: string, n: number, target: number) {
  if (n < target * 0.9 || n > target * 1.1) errors.push(`${name}: ${n}, target ${target} (within 10%)`);
  report.push(`  ${name.padEnd(22)} ${String(n).padStart(4)}  (target ${target})`);
}

function checkTexts(name: string, items: readonly Item[], { clicheFree = true, unique = true } = {}) {
  const seen = new Map<string, string>();
  for (const it of items) {
    if (/[—–]/.test(it.text)) errors.push(`${it.at}: no em or en dashes in UI text`);
    if (clicheFree) {
      const c = clicheIn(it.text);
      if (c) errors.push(`${it.at}: "${it.text}" uses the cliché "${c}"`);
    }
    const key = it.text.toLowerCase();
    if (unique && seen.has(key)) errors.push(`${it.at}: duplicate of ${seen.get(key)}`);
    seen.set(key, it.at);
  }
}

/** Merges items with the same text (listed under two worlds) into one with both worlds. */
function mergeWorlds(items: readonly Item[]): Item[] {
  const byText = new Map<string, Item>();
  for (const it of items) {
    const prev = byText.get(it.text);
    if (prev) prev.worlds = [...new Set([...prev.worlds, ...it.worlds])];
    else byText.set(it.text, { ...it, worlds: [...it.worlds] });
  }
  return [...byText.values()];
}

function write(file: string, data: unknown) {
  writeFileSync(join(dataDir, file), `${JSON.stringify(data, null, 1)}\n`);
}

// ---------- Objects ----------
const objects = mergeWorlds(readList('objects.txt'));
checkTexts('objects', objects);
checkCount('objects', objects.length, 300);
for (const o of objects) if (!/^[A-Z]/.test(o.text) || /[.!?]$/.test(o.text)) errors.push(`${o.at}: objects start with a capital and have no end punctuation`);
write('objects.json', objects.map((o) => ({ text: o.text, worlds: o.worlds })));

/** A text's detection targets: each counted word with its other forms. */
const targets = (text: string) =>
  titleWords(text).map((w) => {
    const forms = formsOf(w);
    forms.delete(w);
    return { w, forms: [...forms].sort() };
  });

// ---------- Titles ----------
const titles = readList('titles.txt');
checkTexts('titles', titles);
checkCount('titles', titles.length, 200);
for (const t of titles) {
  const n = t.text.split(/\s+/).length;
  if (n < 1 || n > 5) errors.push(`${t.at}: "${t.text}" has ${n} words (1 to 5)`);
}
write('titles.json', titles.map((t) => ({ text: t.text, words: targets(t.text) })));

// ---------- report ----------
console.log('Exercise banks');
report.forEach((r) => console.log(r));
if (errors.length) {
  console.error(`\n${errors.length} check(s) failed:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log('All exercise bank checks passed.');
