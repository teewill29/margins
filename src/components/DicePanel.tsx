import { loadDice, useContent } from '../data/content';
import { setPageState } from '../db/pages';
import type { DiceState } from '../db/types';
import { DICE, rollDice, type Die } from '../lib/pick';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';

const LABEL: Record<Die, string> = { pov: 'Point of view', tense: 'Tense', place: 'Place', banned: 'Banned word' };

export function DicePanel({ pageId, state, bannedUses }: { pageId: string; state: DiceState; bannedUses: number }) {
  const dice = useContent(loadDice);

  const roll = (which: readonly Die[] = DICE) => {
    if (!dice) return;
    const rolls = state.rolls + 1;
    const faces = { ...dice, banned: dice.banned.map((b) => b.w) };
    void setPageState(pageId, { ...rollDice(faces, `page:${pageId}:dice:${rolls}`, state, which), rolls });
  };

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <PanelLabel>Constraint dice</PanelLabel>
        <button type="button" className="text-btn" onClick={() => roll()} disabled={!dice}>
          Roll all
        </button>
      </div>
      <div className="dice">
        {DICE.map((d) => (
          <button key={d} type="button" className={`die die--${d}`} onClick={() => roll([d])} disabled={!dice} aria-label={`${LABEL[d]}: ${state[d]}. Tap to reroll`}>
            <span className="die__label">{LABEL[d]}</span>
            <span className="die__face">{state[d]}</span>
          </button>
        ))}
      </div>
      <p className={bannedUses ? 'panel-status panel-status--done' : 'panel-status'} role="status">
        {bannedUses ? `"${state.banned}" shows up ${bannedUses === 1 ? 'once' : `${bannedUses} times`}` : `No "${state.banned}" so far. Tap a die to reroll it.`}
      </p>
    </IndexCard>
  );
}
