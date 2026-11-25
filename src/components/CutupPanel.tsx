import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { setPageState } from '../db/pages';
import type { CutupState } from '../db/types';
import { chop } from '../lib/cutup';
import { pageTitleDate } from '../lib/date';
import { previewLines } from '../lib/pad';
import { activePad } from '../state/padRegistry';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';
import { Sheet, SheetButton } from './Sheet';

export function CutupPanel({ pageId, state }: { pageId: string; state: CutupState }) {
  const [draft, setDraft] = useState(state.source);
  const [editing, setEditing] = useState(!state.source);
  const [picking, setPicking] = useState(false);
  const scraps = useMemo(() => chop(state.source, `${state.seed}:chop:${state.rechops}`), [state.source, state.seed, state.rechops]);
  const pages = useLiveQuery(
    () => (picking ? db.pages.orderBy('updatedAt').reverse().filter((p) => !p.archived && p.id !== pageId && p.body.trim().length > 0).toArray() : []),
    [picking, pageId],
  );

  const takeText = (source: string) => {
    void setPageState(pageId, { ...state, source, rechops: 0, usedFragments: [] });
    setEditing(false);
  };

  const send = (i: number, text: string) => {
    activePad()?.insertAtCaret(text);
    if (!state.usedFragments.includes(i)) void setPageState(pageId, { ...state, usedFragments: [...state.usedFragments, i] });
  };

  if (editing) {
    return (
      <IndexCard id={pageId}>
        <div className="panel-head">
          <PanelLabel>Paste a text</PanelLabel>
          <button type="button" className="text-btn" onClick={() => setPicking(true)}>
            Use a page
          </button>
        </div>
        <textarea
          className="cutup-source"
          aria-label="Text to cut up"
          placeholder="An old lyric, a news story, a page of a paperback…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
        />
        <div className="settings-row">
          <button type="button" className="btn btn--primary" disabled={!draft.trim()} onClick={() => takeText(draft)}>
            Chop it
          </button>
          {state.source && (
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
        {picking && (
          <Sheet title="Use a page" onClose={() => setPicking(false)}>
            {pages?.length === 0 && <p className="sheet__body">No other pages with writing yet.</p>}
            <div className="sheet__scroll">
              {pages?.map((p) => (
                <SheetButton
                  key={p.id}
                  onClick={() => {
                    setDraft(p.body);
                    setPicking(false);
                  }}
                >
                  {p.title ?? previewLines(p.body, 1)[0] ?? pageTitleDate(p.date)}
                </SheetButton>
              ))}
            </div>
          </Sheet>
        )}
      </IndexCard>
    );
  }

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <PanelLabel>Cut-up</PanelLabel>
        <div>
          <button type="button" className="text-btn" onClick={() => setEditing(true)}>
            New text
          </button>
          <button type="button" className="text-btn" onClick={() => void setPageState(pageId, { ...state, rechops: state.rechops + 1, usedFragments: [] })}>
            Rechop
          </button>
        </div>
      </div>
      <p className="panel-hint">Tap scraps to drop them where you're writing.</p>
      <div className="scraps">
        {scraps.map((s, i) => (
          <button
            key={`${i}:${s}`}
            type="button"
            className={state.usedFragments.includes(i) ? 'scrap scrap--used' : 'scrap'}
            style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}
            onClick={() => send(i, s)}
          >
            {s}
          </button>
        ))}
      </div>
    </IndexCard>
  );
}
