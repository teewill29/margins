// npm run bank: builds src/data/words.json from the source lists in scripts/bank/ and runs the
// WORDS.md checks. Fails (exit 1) if any check breaks. Uses the CMU dictionary for syllables and
// rhyme keys, and formsOf (compromise) for word forms; neither ships to the app.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { syllable } from 'syllable';
import { WORLDS, type Pos, type WordEntry } from '../../src/lib/draw';
import { formsOf } from '../../src/lib/forms';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const FILES: Record<Pos, string> = { noun: 'nouns.txt', verb: 'verbs.txt', texture: 'textures.txt', place: 'places.txt', abstract: 'abstract.txt' };
const TARGET: Record<Pos, number> = { noun: 1200, verb: 500, texture: 300, place: 200, abstract: 150 };
const CONC: Record<Pos, [number, number]> = { noun: [4, 5], verb: [3, 5], texture: [3, 5], place: [4, 5], abstract: [1, 2] };
const CLICHES = 'love heart baby tonight forever fire rain soul dream broken alone feel sky eyes night light world stars angel shine tears goodbye cry kiss hold touch crazy wild free rise fly fall lost home'.split(' ');
const WORLD_IDS = new Set<string>(WORLDS);
const MIN_NOUNS_PER_WORLD = 60;

interface Draft { w: string; pos: Pos; conc: number; common: number; worlds: Set<string>; file: string }

const errors: string[] = [];
const warnings: string[] = [];
const drafts = new Map<string, Draft>();

for (const [pos, file] of Object.entries(FILES) as [Pos, string][]) {
  let conc = 4;
  let common = 4;
  let world: string | null = null;
  readFileSync(join(here, file), 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const at = `${file}:${i + 1}`;
    if (!line || line.startsWith('# ')) return;
    if (line.startsWith('@default')) {
      conc = Number(/conc=(\d)/.exec(line)?.[1] ?? conc);
      common = Number(/common=(\d)/.exec(line)?.[1] ?? common);
      return;
    }
    if (line.startsWith('@')) return;
    if (line.startsWith('## ')) {
      const id = line.slice(3).trim();
      world = id === '-' ? null : id;
      if (world && !WORLD_IDS.has(world)) errors.push(`${at}: unknown world "${world}"`);
      return;
    }
    const [w = '', ...mods] = line.split(/\s+/);
    if (!/^[a-z][a-z'-]*[a-z]$/.test(w)) return void errors.push(`${at}: "${w}" isn't a single lowercase word`);
    let c = conc;
    let m = common;
    for (const mod of mods) {
      const mm = /^([cm])([1-5])$/.exec(mod);
      if (!mm) errors.push(`${at}: bad modifier "${mod}"`);
      else if (mm[1] === 'c') c = Number(mm[2]);
      else m = Number(mm[2]);
    }
    const prev = drafts.get(w);
    if (prev && prev.pos !== pos) return void errors.push(`${at}: "${w}" is already a ${prev.pos} in ${prev.file}`);
    const d = prev ?? { w, pos, conc: c, common: m, worlds: new Set<string>(), file };
    if (world) d.worlds.add(world);
    drafts.set(w, d);
  });
}

// ---------- pronunciation ----------
const cmu = dictionary as Record<string, string>;
function phones(w: string): string[] | null {
  const parts = w.split('-');
  const out: string[] = [];
  for (const p of parts) {
    const pr = cmu[p] ?? cmu[p.replace(/'/g, '')];
    if (!pr) return null;
    out.push(...pr.split(' '));
  }
  return out;
}
function rhymeKey(w: string, ph: string[] | null): string {
  if (!ph) return `~${w.replace(/[^a-z]/g, '').slice(-3)}`;
  let i = ph.length - 1;
  while (i >= 0 && !/[12]$/.test(ph[i] as string)) i--;
  if (i < 0) {
    i = ph.length - 1;
    while (i >= 0 && !/\d$/.test(ph[i] as string)) i--;
  }
  return ph.slice(Math.max(i, 0)).map((p) => p.replace(/\d/g, '')).join(' ');
}

// ---------- build ----------
const clicheForms = new Map(CLICHES.map((c) => [c, formsOf(c)]));
const entries: WordEntry[] = [];
for (const d of [...drafts.values()].sort((a, b) => (a.pos === b.pos ? a.w.localeCompare(b.w) : 0))) {
  const [lo, hi] = CONC[d.pos];
  if (d.conc < lo || d.conc > hi) errors.push(`${d.file}: "${d.w}" conc ${d.conc} is outside ${lo}-${hi} for ${d.pos}`);
  if (d.worlds.size > 2) errors.push(`${d.file}: "${d.w}" is in ${d.worlds.size} worlds (max 2): ${[...d.worlds].join(', ')}`);
  if (d.w.length > 11) warnings.push(`"${d.w}" is ${d.w.length} letters; may wrap in a grid cell`);
  const forms = formsOf(d.w, d.pos);
  if (d.pos !== 'abstract') {
    for (const [c, cf] of clicheForms) {
      if (cf.has(d.w) || forms.has(c)) errors.push(`${d.file}: "${d.w}" is or shares a root with the cliché "${c}"`);
    }
  }
  const ph = phones(d.w);
  const syl = ph ? ph.filter((p) => /\d$/.test(p)).length : syllable(d.w);
  forms.delete(d.w);
  entries.push({
    w: d.w, pos: d.pos, conc: d.conc as WordEntry['conc'], common: d.common as WordEntry['common'],
    syl, worlds: [...d.worlds].sort(), rhyme: rhymeKey(d.w, ph), forms: [...forms].sort(),
  });
}

// ---------- checks ----------
const byPos = (p: Pos) => entries.filter((e) => e.pos === p);
for (const p of Object.keys(TARGET) as Pos[]) {
  const n = byPos(p).length;
  const t = TARGET[p];
  if (n < t * 0.9 || n > t * 1.1) errors.push(`${p}: ${n} words, target ${t} (within 10%: ${Math.ceil(t * 0.9)}-${Math.floor(t * 1.1)})`);
}
const nounsPerWorld = new Map<string, number>(WORLDS.map((w) => [w, 0]));
for (const e of byPos('noun')) for (const w of e.worlds) nounsPerWorld.set(w, (nounsPerWorld.get(w) ?? 0) + 1);
for (const [w, n] of nounsPerWorld) if (n < MIN_NOUNS_PER_WORLD) errors.push(`world "${w}" has ${n} nouns (needs ${MIN_NOUNS_PER_WORLD})`);

// ---------- report ----------
console.log('Word bank');
for (const p of Object.keys(TARGET) as Pos[]) console.log(`  ${p.padEnd(8)} ${String(byPos(p).length).padStart(5)}  (target ${TARGET[p]})`);
console.log(`  total    ${String(entries.length).padStart(5)}`);
console.log('Per world (nouns / all):');
console.log(
  '  ' +
    WORLDS.map((w) => `${w} ${nounsPerWorld.get(w)}/${entries.filter((e) => e.worlds.includes(w)).length}`).join(', '),
);
const missingCmu = entries.filter((e) => e.rhyme.startsWith('~')).length;
console.log(`Not in CMU dictionary (rhyme from spelling): ${missingCmu}`);
if (warnings.length && process.argv.includes('--verbose')) warnings.forEach((w) => console.log(`  warn: ${w}`));

if (errors.length) {
  console.error(`\n${errors.length} check(s) failed:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
const out = join(root, 'src', 'data', 'words.json');
writeFileSync(out, `[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`);
console.log(`\nAll checks passed. Wrote ${entries.length} words to src/data/words.json`);

// Syllable corrections: bank words and their forms where the CMU dictionary disagrees with the
// `syllable` package (which miscounts compounds like "junkyard"). syllables.ts reads this table
// after the hand-written overrides and before the package.
const fixes: Record<string, number> = {};
for (const e of entries) {
  for (const w of [e.w, ...e.forms]) {
    if (w.includes('-') || fixes[w] !== undefined) continue;
    const ph = phones(w);
    if (!ph) continue;
    const n = ph.filter((p) => /\d$/.test(p)).length;
    if (n !== syllable(w)) fixes[w] = n;
  }
}
const sorted = Object.fromEntries(Object.entries(fixes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(root, 'src', 'data', 'syllableFixes.json'), `${JSON.stringify(sorted)}\n`);
console.log(`Wrote ${Object.keys(sorted).length} syllable corrections to src/data/syllableFixes.json`);
