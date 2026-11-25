import { useState } from 'react';
import type { Bank } from '../data/bank';
import { setPageState } from '../db/pages';
import type { LadderState, Override } from '../db/types';
import { recordShown, setBanned, statsMap } from '../db/wordStats';
import type { WordResult } from '../lib/detect';
import { shuffleColumn } from '../lib/draw';
import { plural } from '../lib/format';
import { pairPhrase } from '../lib/ladder';
import { useLongPress } from '../hooks/useLongPress';
import { activePad } from '../state/padRegistry';
import { useToast } from '../state/toast';
import { CloseIcon, CrossIcon, ShuffleIcon, TickIcon } from './Icons';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';
import { ConfirmSheet, Sheet, SheetButton } from './Sheet';

interface Props {
  pageId: string;
  state: LadderState;
  bank: Bank;
  results: readonly WordResult[];
}

type Column = 'nouns' | 'verbs';

export function LadderPanel({ pageId, state, bank, results }: Props) {
  const toast = useToast();
  const [picked, setPicked] = useState<{ noun?: string; verb?: string }>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ column: Column; used: number } | null>(null);
  const byWord = new Map(results.map((r) => [r.word, r]));
  const usedCount = results.filter((r) => r.used).length;
  const total = state.nouns.length + state.verbs.length;
  const save = (next: LadderState) => setPageState(pageId, next);

  const choose = (column: Column, w: string) => {
    const next = column === 'nouns' ? { ...picked, noun: picked.noun === w ? undefined : w } : { ...picked, verb: picked.verb === w ? undefined : w };
    if (next.noun && next.verb) {
      const phrase = pairPhrase(next.noun, bank.byW.get(next.noun)?.forms ?? [], next.verb);
      if (!state.pairs.includes(phrase)) void save({ ...state, pairs: [...state.pairs, phrase] });
      setPicked({});
    } else setPicked(next);
  };

  const shuffle = async (column: Column) => {
    const n = (column === 'nouns' ? state.nounShuffles : state.verbShuffles) + 1;
    const words = shuffleColumn({ seedBase: state.seed, column, n, ladder: state, bank: bank.words, stats: await statsMap() });
    void recordShown(words);
    const keep = new Set([...(column === 'nouns' ? state.verbs : state.nouns), ...words]);
    await save({
      ...state,
      [column]: words,
      ...(column === 'nouns' ? { nounShuffles: n } : { verbShuffles: n }),
      overrides: Object.fromEntries(Object.entries(state.overrides).filter(([w]) => keep.has(w))),
    });
    setPicked({});
  };

  const askShuffle = (column: Column) => {
    const used = state[column].filter((w) => byWord.get(w)?.used).length;
    if (used) setConfirm({ column, used });
    else void shuffle(column);
  };

  const setOverride = (w: string, o: Override) => void save({ ...state, overrides: { ...state.overrides, [w]: o } });

  const removePair = (p: string) => {
    void save({ ...state, pairs: state.pairs.filter((x) => x !== p) });
    toast({ text: 'Pair removed', action: { label: 'Undo', run: () => void save({ ...state }) } });
  };

  const column = (col: Column, title: string) => (
    <div className="ladder__col">
      <div className="ladder__col-head">
        <span className="ladder__col-title">{title}</span>
        <button type="button" className="icon-btn" aria-label={`Shuffle ${title.toLowerCase()}`} onClick={() => askShuffle(col)}>
          <ShuffleIcon size={18} />
        </button>
      </div>
      {state[col].map((w) => (
        <LadderWord
          key={w}
          word={w}
          used={byWord.get(w)?.used ?? false}
          override={state.overrides[w] ?? 'auto'}
          selected={picked.noun === w || picked.verb === w}
          onTap={() => choose(col, w)}
          onLongPress={() => setMenuFor(w)}
        />
      ))}
    </div>
  );

  return (
    <IndexCard id={pageId}>
      <div className="grid-head">
        <PanelLabel>Pair the odd ones</PanelLabel>
        <span className={usedCount === total ? 'grid-count grid-count--done' : 'grid-count'} role="status">
          {usedCount} of {total}
          {usedCount === total && ' · done'}
        </span>
      </div>
      <p className="panel-hint">Tap a noun, then a verb.</p>
      <div className="ladder">
        {column('nouns', 'Nouns')}
        {column('verbs', 'Verbs')}
      </div>
      {state.pairs.length > 0 && (
        <div className="pairs">
          <span className="pairs__label">Pairs</span>
          {state.pairs.map((p) => (
            <span key={p} className="pair">
              <button type="button" className="pair__text" onClick={() => activePad()?.insertAtCaret(p)} aria-label={`Insert "${p}" into the page`}>
                {p}
              </button>
              <button type="button" className="pair__remove" aria-label={`Remove "${p}"`} onClick={() => removePair(p)}>
                <CloseIcon size={14} />
              </button>
            </span>
          ))}
          <span className="panel-hint">Tap a pair to add it where you're writing.</span>
        </div>
      )}

      {menuFor && (
        <Sheet title={menuFor} onClose={() => setMenuFor(null)}>
          {(['used', 'unused', 'auto'] as const).map((o) => (
            <SheetButton
              key={o}
              onClick={() => {
                setOverride(menuFor, o);
                setMenuFor(null);
              }}
            >
              {o === 'used' ? 'Mark as used' : o === 'unused' ? 'Mark as not used' : 'Count automatically'}
              {(state.overrides[menuFor] ?? 'auto') === o && <span className="sheet__current"> · current</span>}
            </SheetButton>
          ))}
          <SheetButton
            danger
            onClick={() => {
              const w = menuFor;
              setMenuFor(null);
              void setBanned(w, true);
              toast({ text: `Banned "${w}". It won't be drawn again.`, action: { label: 'Undo', run: () => void setBanned(w, false) } });
            }}
          >
            Ban forever
          </SheetButton>
        </Sheet>
      )}
      {confirm && (
        <ConfirmSheet
          title={`Shuffle the ${confirm.column}?`}
          body={`${plural(confirm.used, 'word')} you've used will be replaced.`}
          confirm="Shuffle"
          onConfirm={() => void shuffle(confirm.column)}
          onClose={() => setConfirm(null)}
        />
      )}
    </IndexCard>
  );
}

interface WordProps {
  word: string;
  used: boolean;
  override: Override;
  selected: boolean;
  onTap(): void;
  onLongPress(): void;
}

function LadderWord({ word, used, override, selected, onTap, onLongPress }: WordProps) {
  const lp = useLongPress(onLongPress);
  return (
    <button
      type="button"
      className={['word-cell', 'ladder__word', used && 'word-cell--used', selected && 'ladder__word--picked'].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={`${word}${used ? ', used' : ''}${selected ? ', picked' : ''}`}
      {...lp.handlers}
      onClick={() => !lp.consumeClick() && onTap()}
    >
      {word}
      {override === 'used' && <TickIcon className="word-cell__mark" />}
      {override === 'unused' && <CrossIcon className="word-cell__mark" />}
    </button>
  );
}
