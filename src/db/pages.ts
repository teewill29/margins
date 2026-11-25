import { localDate } from '../lib/date';
import { splitLines } from '../lib/pad';
import { resolvePin } from '../lib/pins';
import { db } from './db';
import { getSetting } from './settings';
import type { ExerciseState, ExerciseType, Page } from './types';

function initialState(exercise: ExerciseType): ExerciseState {
  switch (exercise) {
    case 'free':
      return {};
    default:
      throw new Error(`${exercise} pages arrive in a later phase`);
  }
}

export async function createPage(exercise: ExerciseType, id: string = crypto.randomUUID()): Promise<Page> {
  const now = Date.now();
  const page: Page = {
    id,
    createdAt: now,
    updatedAt: now,
    date: localDate(),
    title: null,
    exercise,
    state: initialState(exercise),
    body: '',
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
  await db.transaction('rw', db.pages, db.memos, async () => {
    const page = await db.pages.get(id);
    if (!page?.archived) throw new Error('Only archived pages can be deleted');
    await db.memos.where('pageId').equals(id).delete();
    await db.pages.delete(id);
  });
}
