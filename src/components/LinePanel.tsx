import { drawLine, setPageState } from '../db/pages';
import type { LineState } from '../db/types';
import { activePad } from '../state/padRegistry';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';

/** First line: the pad starts with it. Last line: shown as "End here:" to write toward. */
export function LinePanel({ pageId, kind, state }: { pageId: string; kind: 'first' | 'last'; state: LineState }) {
  const another = async () => {
    const draws = state.draws + 1;
    const line = await drawLine(kind, `page:${pageId}:line:${draws}`, state.line);
    if (!line) return;
    // A first line in the pad is swapped too, unless it's been edited.
    if (kind === 'first') activePad()?.replaceFirstLine(state.line, line);
    await setPageState(pageId, { ...state, line, draws });
  };

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <PanelLabel>{kind === 'first' ? 'First line' : 'Last line'}</PanelLabel>
        <button type="button" className="text-btn" onClick={() => void another()}>
          Another
        </button>
      </div>
      {kind === 'first' ? (
        <p className="prompt-type">{state.line}</p>
      ) : (
        <>
          <p className="panel-hint">Write toward it.</p>
          <p className="end-here">
            <span className="end-here__label">End here:</span> {state.line}
          </p>
        </>
      )}
    </IndexCard>
  );
}
