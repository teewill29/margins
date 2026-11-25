import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Bank } from '../data/bank';
import { db } from '../db/db';
import { setPageState } from '../db/pages';
import type { GridState, Override } from '../db/types';
import { recordShown, recordSwap, setBanned, setFavorite, statsMap } from '../db/wordStats';
import { shortDate } from '../lib/date';
import { changedForms, type WordResult } from '../lib/detect';
import { drawDaily, MAX_SWAPS, shuffleGrid, swapInGrid, type Difficulty } from '../lib/draw';
import { plural } from '../lib/format';
import { useLongPress } from '../hooks/useLongPress';
import { useToast } from '../state/toast';
import { CrossIcon, GearIcon, LockIcon, ShuffleIcon, TickIcon } from './Icons';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';
import { Segmented } from './Segmented';
import { ConfirmSheet, Sheet, SheetButton } from './Sheet';

const NEXT: Record<Override, Override> = { auto: 'used', used: 'unused', unused: 'auto' };
const DIFFICULTIES: [Difficulty, string][] = [['loose', 'Loose'], ['medium', 'Medium'], ['wild', 'Wild']];

interface Props {
  pageId: string;
  date: string;
  state: GridState;
  bank: Bank;
  results: readonly WordResult[];
}

export function WordGrid({ pageId, date, state, bank, results }: Props) {
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; run: () => void } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stats = useLiveQuery(() => db.wordStats.bulkGet(state.words), [state.words.join(',')]);

  const byWord = new Map(results.map((r) => [r.word, r]));
  const usedCount = results.filter((r) => r.used).length;
  const done = usedCount === state.words.length;
  const matched = changedForms(results);
  const swapsLeft = MAX_SWAPS - state.swapsUsed;

  const save = (next: GridState) => setPageState(pageId, next);
  const keepOverrides = (words: readonly string[]) =>
    Object.fromEntries(Object.entries(state.overrides).filter(([w]) => words.includes(w)));
  const usedUnlocked = state.words.filter((w) => byWord.get(w)?.used && !state.locked.includes(w));

  /** Runs `fn` now, or after a confirm if it would replace words already used. */
  const guarded = (what: string, label: string, fn: () => void) => {
    if (usedUnlocked.length === 0) return fn();
    setConfirm({
      title: `${what}?`,
      body: `${plural(usedUnlocked.length, 'word')} you've used will be replaced. Locked words stay.`,
      label,
      run: fn,
    });
  };

  const redraw = async (patch: Partial<GridState> = {}) => {
    const next = { ...state, ...patch };
    const g = shuffleGrid({
      seedBase: state.seed, shuffles: state.shuffles, words: state.words, locked: next.locked,
      difficulty: next.difficulty, bank: bank.words, stats: await statsMap(),
    });
    void recordShown(g.words.filter((w) => !state.words.includes(w)));
    await save({ ...next, world: g.world, words: g.words, shuffles: g.shuffles, overrides: keepOverrides(g.words) });
  };

  const setDaily = async (daily: boolean) => {
    if (daily) {
      const g = drawDaily(date, bank.words);
      void recordShown(g.words);
      await save({ ...state, daily: true, world: g.world, words: g.words, locked: [], overrides: keepOverrides(g.words) });
    } else {
      await redraw({ daily: false, locked: [] });
    }
  };

  const swap = async (cell: number) => {
    const old = state.words[cell];
    const next = swapInGrid({ seedBase: state.seed, words: state.words, world: state.world, swapsUsed: state.swapsUsed, cell, bank: bank.words, stats: await statsMap() });
    if (!next || old === undefined) return;
    void recordSwap(old);
    void recordShown([next.words[cell] as string]);
    await save({ ...state, words: next.words, swapsUsed: next.swapsUsed, locked: state.locked.filter((w) => w !== old), overrides: keepOverrides(next.words) });
  };

  const menuWord = menuFor;
  const menuStat = menuWord ? stats?.[state.words.indexOf(menuWord)] : undefined;

  return (
    <IndexCard id={pageId}>
      <div className="grid-head">
        <PanelLabel>{state.daily ? `Daily grid · ${shortDate(date)}` : `Use all ${state.words.length}`}</PanelLabel>
        <div className="grid-head__right">
          <span className={done ? 'grid-count grid-count--done' : 'grid-count'} role="status">
            {usedCount} of {state.words.length}
            {done && ' · done'}
          </span>
          {!state.daily && (
            <button type="button" className="icon-btn" aria-label="Shuffle grid" onClick={() => guarded('Shuffle the grid', 'Shuffle', () => void redraw())}>
              <ShuffleIcon />
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Grid settings" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
          </button>
        </div>
      </div>

      <div className="word-grid">
        {state.words.map((w) => (
          <WordCell
            key={w}
            word={w}
            used={byWord.get(w)?.used ?? false}
            override={state.overrides[w] ?? 'auto'}
            locked={state.locked.includes(w)}
            onTap={() => void save({ ...state, overrides: { ...state.overrides, [w]: NEXT[state.overrides[w] ?? 'auto'] } })}
            onLongPress={() => setMenuFor(w)}
          />
        ))}
      </div>

      {matched.length > 0 && (
        <p className="grid-matched">matched: {matched.map(([t, w]) => `${t} → ${w}`).join(' · ')}</p>
      )}

      {menuWord && (
        <Sheet title={menuWord} onClose={() => setMenuFor(null)}>
          {!state.daily && (
            <SheetButton
              onClick={() => {
                setMenuFor(null);
                if (swapsLeft > 0) void swap(state.words.indexOf(menuWord));
              }}
            >
              {swapsLeft > 0 ? `Swap this word (${plural(swapsLeft, 'swap')} left)` : 'No swaps left on this page'}
            </SheetButton>
          )}
          {!state.daily && (
            <SheetButton
              onClick={() => {
                setMenuFor(null);
                const locked = state.locked.includes(menuWord) ? state.locked.filter((x) => x !== menuWord) : [...state.locked, menuWord];
                void save({ ...state, locked });
              }}
            >
              {state.locked.includes(menuWord) ? 'Unlock' : 'Lock'}
            </SheetButton>
          )}
          <SheetButton
            onClick={() => {
              setMenuFor(null);
              void setFavorite(menuWord, !menuStat?.favorite);
            }}
          >
            {menuStat?.favorite ? 'Unfavorite' : 'Favorite'}
          </SheetButton>
          {!menuStat?.banned && (
            <SheetButton
              danger
              onClick={() => {
                setMenuFor(null);
                void setBanned(menuWord, true);
                toast({ text: `Banned "${menuWord}". It won't be drawn again.`, action: { label: 'Undo', run: () => void setBanned(menuWord, false) } });
              }}
            >
              Ban forever
            </SheetButton>
          )}
        </Sheet>
      )}

      {settingsOpen && (
        <Sheet title="Grid settings" onClose={() => setSettingsOpen(false)}>
          <div className="sheet__field">
            <span className="sheet__field-label">Difficulty</span>
            <Segmented
              label="Difficulty"
              value={state.difficulty}
              options={DIFFICULTIES}
              onChange={(d) => {
                if (d === state.difficulty) return;
                setSettingsOpen(false);
                if (state.daily) void save({ ...state, difficulty: d });
                else guarded('Redraw the grid', 'Redraw', () => void redraw({ difficulty: d }));
              }}
            />
            <span className="sheet__hint">Loose words share a world. Wild ones barely do.</span>
          </div>
          <div className="sheet__field">
            <span className="sheet__field-label">Daily grid</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.daily}
              className={state.daily ? 'switch switch--on' : 'switch'}
              onClick={() => {
                setSettingsOpen(false);
                guarded(state.daily ? 'Turn off the daily grid' : 'Use the daily grid', 'Redraw', () => void setDaily(!state.daily));
              }}
            >
              <span className="switch__knob" />
              <span className="switch__text">{state.daily ? 'On' : 'Off'}</span>
            </button>
            <span className="sheet__hint">Everyone gets the same 16 words today. No swaps or shuffles.</span>
          </div>
        </Sheet>
      )}

      {confirm && (
        <ConfirmSheet title={confirm.title} body={confirm.body} confirm={confirm.label} onConfirm={confirm.run} onClose={() => setConfirm(null)} />
      )}
    </IndexCard>
  );
}

interface CellProps {
  word: string;
  used: boolean;
  override: Override;
  locked: boolean;
  onTap(): void;
  onLongPress(): void;
}

function WordCell({ word, used, override, locked, onTap, onLongPress }: CellProps) {
  const lp = useLongPress(onLongPress);
  const state = override === 'used' ? 'marked used' : override === 'unused' ? 'marked not used' : used ? 'used' : 'not used';
  return (
    <button
      type="button"
      className={used ? 'word-cell word-cell--used' : 'word-cell'}
      aria-label={`${word}, ${state}${locked ? ', locked' : ''}`}
      {...lp.handlers}
      onClick={() => !lp.consumeClick() && onTap()}
    >
      {word}
      {override === 'used' && <TickIcon className="word-cell__mark" />}
      {override === 'unused' && <CrossIcon className="word-cell__mark" />}
      {locked && <LockIcon className="word-cell__lock" />}
    </button>
  );
}
