import { loadObjects, useContent } from '../data/content';
import { setPageState } from '../db/pages';
import type { ObjectState } from '../db/types';
import { pickIndex } from '../lib/pick';
import { IndexCard } from './IndexCard';

export const SENSES = ['Sight', 'Sound', 'Smell', 'Taste', 'Touch', 'Body', 'Motion'] as const;

export function ObjectPanel({ pageId, state }: { pageId: string; state: ObjectState }) {
  const objects = useContent(loadObjects);

  const newObject = () => {
    if (!objects) return;
    const draws = state.draws + 1;
    const current = objects.findIndex((o) => o.text === state.object);
    const next = objects[pickIndex(`page:${pageId}:object:${draws}`, objects.length, new Set([current]))];
    if (next) void setPageState(pageId, { ...state, object: next.text, draws });
  };

  const toggle = (sense: string) => {
    const senses = state.senses.includes(sense) ? state.senses.filter((s) => s !== sense) : [...state.senses, sense];
    void setPageState(pageId, { ...state, senses });
  };

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <span className="card-label">Your object</span>
        <button type="button" className="text-btn" onClick={newObject} disabled={!objects}>
          New object
        </button>
      </div>
      <p className="prompt-serif">{state.object}</p>
      <div className="chips" role="group" aria-label="Senses">
        {SENSES.map((s) => {
          const on = state.senses.includes(s);
          return (
            <button key={s} type="button" className={on ? 'chip chip--on' : 'chip'} aria-pressed={on} onClick={() => toggle(s)}>
              {on && '✓ '}
              {s}
            </button>
          );
        })}
      </div>
    </IndexCard>
  );
}
