import { Fragment } from 'react';
import { loadCharacters, useContent } from '../data/content';
import { setPageState } from '../db/pages';
import type { CharacterState } from '../db/types';
import { capitalize, PARTS, rollCharacter, type CharacterPart } from '../lib/character';
import { IndexCard } from './IndexCard';
import { PanelLabel } from './PanelLabel';

/** "Dale, 58, works overnights at a toll booth. Wants ... Keeps ..." with every part tappable. */
export function CharacterPanel({ pageId, state }: { pageId: string; state: CharacterState }) {
  const tables = useContent(loadCharacters);

  const roll = (which: readonly CharacterPart[] = PARTS) => {
    if (!tables) return;
    const rolls = state.rolls + 1;
    void setPageState(pageId, { ...rollCharacter(tables, `page:${pageId}:character:${rolls}`, state, which), rolls });
  };

  // Inline spans (not buttons) so long parts wrap like the sentence they're in.
  const part = (p: CharacterPart, text: string, after: string) => (
    <Fragment key={p}>
      <span
        role="button"
        tabIndex={0}
        className="char-part"
        aria-label={`${text}. Reroll the ${p}`}
        onClick={() => roll([p])}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            roll([p]);
          }
        }}
      >
        {text}
      </span>
      {after}
    </Fragment>
  );

  return (
    <IndexCard id={pageId}>
      <div className="panel-head">
        <PanelLabel>Character</PanelLabel>
        <button type="button" className="text-btn" onClick={() => roll()} disabled={!tables}>
          Reroll all
        </button>
      </div>
      <p className="char-line">
        {part('name', state.name, ', ')}
        {part('age', String(state.age), ', ')}
        {part('job', state.job, '. ')}
        {part('want', capitalize(state.want), '. ')}
        {part('obstacle', capitalize(state.obstacle), '.')}
      </p>
      <p className="panel-hint">Tap any part to reroll it.</p>
    </IndexCard>
  );
}
