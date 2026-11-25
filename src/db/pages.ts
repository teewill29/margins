import { localDate } from '../lib/date';
import { splitLines } from '../lib/pad';
import { resolvePin } from '../lib/pins';
import { db } from './db';
import { getSetting, setSetting } from './settings';
import type { CharacterState, DiceState, ExerciseState, ExerciseType, GridState, LineState, ObjectState, Page, TitleState } from './types';
import { recordShown, statsMap } from './wordStats';

async function initialState(exercise: ExerciseType, id: string, date: string): Promise<ExerciseState> {
  switch (exercise) {
    case 'free':
      return {};
    case 'grid': {
      const [{ loadBank }, { drawDaily, drawGrid }] = await Promise.all([import('../data/bank'), import('../lib/draw')]);
      const bank = await loadBank();
      const [difficulty, daily] = await Promise.all([getSetting('difficulty'), getSetting('dailyGrid')]);
      const seed = `page:${id}`;
      const grid = daily ? drawDaily(date, bank.words) : drawGrid({ seed, difficulty, bank: bank.words, stats: await statsMap() });
      void recordShown(grid.words);
      const state: GridState = { seed, daily, difficulty, world: grid.world, words: grid.words, locked: [], overrides: {}, swapsUsed: 0, shuffles: 0 };
      return state;
    }
    case 'object': {
      const [{ loadObjects }, { pickIndex }] = await Promise.all([import('../data/content'), import('../lib/pick')]);
      const objects = await loadObjects();
      const state: ObjectState = {
        object: objects[pickIndex(`page:${id}:object:1`, objects.length)]?.text ?? 'A coffee mug with a chipped rim',
        senses: [],
        timerMs: (await getSetting('objectTimerMin')) * 60_000,
        elapsedMs: 0,
        running: false,
        startedAt: null,
        draws: 1,
      };
      return state;
    }
    case 'title': {
      const [{ loadTitles }, { pickText, remember }] = await Promise.all([import('../data/content'), import('../lib/pick')]);
      const recent = await getSetting('recentTitles');
      const t = pickText(`page:${id}:title:1`, await loadTitles(), recent)?.text ?? 'Quarter in My Shoe';
      await setSetting('recentTitles', remember(recent, t));
      const state: TitleState = { title: t, draws: 1 };
      return state;
    }
    case 'firstLine':
    case 'lastLine': {
      const line = await drawLine(exercise === 'firstLine' ? 'first' : 'last', `page:${id}:line:1`, null);
      const state: LineState = { line, draws: 1 };
      return state;
    }
    case 'dice': {
      const [{ loadDice }, { rollDice }] = await Promise.all([import('../data/content'), import('../lib/pick')]);
      const d = await loadDice();
      const state: DiceState = { ...rollDice({ ...d, banned: d.banned.map((b) => b.w) }, `page:${id}:dice:1`), rolls: 1 };
      return state;
    }
    case 'character': {
      const [{ loadCharacters }, { rollCharacter }] = await Promise.all([import('../data/content'), import('../lib/character')]);
      const state: CharacterState = { ...rollCharacter(await loadCharacters(), `page:${id}:character:1`), rolls: 1 };
      return state;
    }
    default:
      throw new Error(`${exercise} pages arrive in a later phase`);
  }
}

export async function createPage(exercise: ExerciseType, id: string = crypto.randomUUID()): Promise<Page> {
  const now = Date.now();
  const date = localDate();
  const state = await initialState(exercise, id, date);
  const page: Page = {
    id,
    createdAt: now,
    updatedAt: now,
    date,
    title: null,
    exercise,
    state,
    body: exercise === 'title' ? '[Chorus]\n' : exercise === 'firstLine' ? `${(state as LineState).line}\n` : '',
    level: await getSetting('level'),
    showSyllables: exercise !== 'object' && exercise !== 'cutup',
    panelCollapsed: false,
    activeMs: 0,
    archived: false,
  };
  await db.pages.add(page);
  return page;
}

/** Saves the pad text and moves pinned memos to follow their lines. */
export async function savePageBody(id: string, body: string): Promise<void> {
  const lines = splitLines(body);
  await db.transaction('rw', db.pages, db.memos, async () => {
    await db.pages.update(id, { body, updatedAt: Date.now() });
    const memos = await db.memos.where('pageId').equals(id).toArray();
    for (const m of memos) {
      if (m.pinnedLine === null) continue;
      const pin = resolvePin(lines, m.pinnedLine, m.pinnedText);
      const line = pin?.line ?? null;
      const text = pin?.text ?? null;
      if (line !== m.pinnedLine || text !== m.pinnedText) await db.memos.update(m.id, { pinnedLine: line, pinnedText: text });
    }
  });
}

export async function renamePage(id: string, title: string): Promise<void> {
  const t = title.trim();
  await db.pages.update(id, { title: t || null, updatedAt: Date.now() });
}

/** Archiving doesn't touch updatedAt, so undo puts the page back where it was. */
export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.pages.update(id, { archived });
}

export async function addActiveMs(id: string, ms: number): Promise<void> {
  if (ms <= 0) return;
  await db.pages.where('id').equals(id).modify((p) => {
    p.activeMs += ms;
  });
}

/** Removes an archived page and its memos. Only called after a confirm. */
export async function deletePageForever(id: string): Promise<void> {
  await db.transaction('rw', [db.pages, db.memos, db.audio], async () => {
    const page = await db.pages.get(id);
    if (!page?.archived) throw new Error('Only archived pages can be deleted');
    const memoIds = await db.memos.where('pageId').equals(id).primaryKeys();
    await db.audio.bulkDelete(memoIds);
    await db.memos.bulkDelete(memoIds);
    await db.pages.delete(id);
  });
}

/**
 * A first or last line from the bank plus My lines (same weight), skipping the last 20 shown
 * and the current one. Records it as shown.
 */
export async function drawLine(kind: 'first' | 'last', seed: string, current: string | null): Promise<string> {
  const [{ loadLines }, { pickText, remember }] = await Promise.all([import('../data/content'), import('../lib/pick')]);
  const mine = await db.userLines.where('kind').equals(kind).sortBy('createdAt');
  const pool = [...(await loadLines()).filter((l) => l.kind === kind), ...mine];
  const recent = await getSetting('recentLines');
  const text = pickText(seed, pool, current ? [...recent, current] : recent)?.text ?? '';
  await setSetting('recentLines', remember(recent, text));
  return text;
}

export async function setPageState(id: string, state: ExerciseState): Promise<void> {
  await db.pages.update(id, { state, updatedAt: Date.now() });
}

export async function setShowSyllables(id: string, showSyllables: boolean): Promise<void> {
  await db.pages.update(id, { showSyllables });
}

export async function setPageLevel(id: string, level: Page['level']): Promise<void> {
  await db.pages.update(id, { level });
}
