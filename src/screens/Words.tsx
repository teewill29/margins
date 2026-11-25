import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { SearchIcon } from '../components/Icons';
import { TopBar } from '../components/TopBar';
import { db } from '../db/db';
import type { WordStat } from '../db/types';
import { setBanned, setFavorite } from '../db/wordStats';
import { useToast } from '../state/toast';

/** Settings > Word manager: banned and favorite words, with their swap counts. */
export function Words() {
  const stats = useLiveQuery(() => db.wordStats.orderBy('w').filter((s) => s.banned || s.favorite).toArray(), [], [] as WordStat[]);
  const [query, setQuery] = useState('');
  const toast = useToast();
  const q = query.trim().toLowerCase();
  const shown = stats.filter((s) => !q || s.w.includes(q));
  const banned = shown.filter((s) => s.banned);
  const favorites = shown.filter((s) => s.favorite && !s.banned);

  const row = (s: WordStat, action: 'unban' | 'unfavorite') => (
    <div key={s.w} className="word-row">
      <div className="word-row__text">
        <span className="word-row__word">{s.w}</span>
        <span className="word-row__meta">
          {[s.swaps ? `swapped ${s.swaps}×` : null, s.shown ? `drawn ${s.shown}×` : null, s.used ? `used ${s.used}×` : null].filter(Boolean).join(' · ') ||
            'not drawn yet'}
        </span>
      </div>
      <button
        type="button"
        className="btn btn--small btn--quiet"
        onClick={() => {
          if (action === 'unban') {
            void setBanned(s.w, false);
            toast({ text: `"${s.w}" can be drawn again`, action: { label: 'Undo', run: () => void setBanned(s.w, true) } });
          } else {
            void setFavorite(s.w, false);
            toast({ text: `"${s.w}" isn't a favorite now`, action: { label: 'Undo', run: () => void setFavorite(s.w, true) } });
          }
        }}
      >
        {action === 'unban' ? 'Unban' : 'Unfavorite'}
      </button>
    </div>
  );

  return (
    <main className="screen screen--no-bar">
      <TopBar title="Word manager" back="/settings" backLabel="Back to settings" />
      {stats.length > 0 && (
        <div className="search">
          <label className="search__box">
            <SearchIcon />
            <input
              type="search"
              className="search__input"
              placeholder="Find a word"
              aria-label="Find a word"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      )}
      <section className="settings-section">
        <h2 className="section-label">Banned</h2>
        <p className="settings-note">Never drawn in a grid or ladder. The daily grid ignores bans so everyone gets the same one.</p>
        {banned.length ? banned.map((s) => row(s, 'unban')) : <p className="settings-note">{q ? 'No match.' : 'None. Long-press a word in a grid to ban it.'}</p>}
      </section>
      <section className="settings-section">
        <h2 className="section-label">Favorites</h2>
        <p className="settings-note">Drawn about twice as often.</p>
        {favorites.length ? (
          favorites.map((s) => row(s, 'unfavorite'))
        ) : (
          <p className="settings-note">{q ? 'No match.' : 'None. Long-press a word in a grid to favorite it.'}</p>
        )}
      </section>
    </main>
  );
}
