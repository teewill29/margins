import { loadTitles, useContent } from '../data/content';
import { setPageState } from '../db/pages';
import { getSetting, setSetting } from '../db/settings';
import type { TitleState } from '../db/types';
import { pickText, remember } from '../lib/pick';
import { IndexCard } from './IndexCard';

interface Props {
  pageId: string;
  state: TitleState;
  /** Title words already in the chorus, and how many there are. */
  inChorus: number;
  total: number;
}

export function TitlePanel({ pageId, state, inChorus, total }: Props) {
  const titles = useContent(loadTitles);
  const done = total > 0 && inChorus === total;

  const another = async () => {
    if (!titles) return;
    const draws = state.draws + 1;
    const recent = await getSetting('recentTitles');
    const next = pickText(`page:${pageId}:title:${draws}`, titles, [...recent, state.title]);
    if (!next) return;
    await setSetting('recentTitles', remember(recent, next.text));
    await setPageState(pageId, { ...state, title: next.text, draws });
  };

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <span className="card-label">Your title</span>
        <button type="button" className="text-btn" onClick={() => void another()} disabled={!titles}>
          Another
        </button>
      </div>
      <p className="prompt-serif">{state.title}</p>
      <p className={done ? 'panel-status panel-status--done' : 'panel-status'} role="status">
        {done ? 'Title used in chorus' : `${inChorus} of ${total} title words in the chorus`}
      </p>
    </IndexCard>
  );
}
