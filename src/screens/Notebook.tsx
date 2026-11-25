import { useLiveQuery } from 'dexie-react-hooks';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CloseIcon, GearIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { PageCard } from '../components/PageCard';
import { Sheet, SheetButton } from '../components/Sheet';
import { db } from '../db/db';
import { createPage, setArchived } from '../db/pages';
import { setSetting, useSettings } from '../db/settings';
import type { Page } from '../db/types';
import { backupBanner } from '../lib/backup';
import { plural } from '../lib/format';
import { EXERCISES, type ExerciseType } from '../lib/exercises';
import { matchesQuery, searchText } from '../lib/search';
import { useToast } from '../state/toast';
import { useDropbox } from '../sync/dropbox';

export function Notebook() {
  const pages = useLiveQuery(() => db.pages.orderBy('updatedAt').reverse().filter((p) => !p.archived).toArray());
  const memos = useLiveQuery(() => db.memos.toArray());
  const settings = useSettings();
  const dropbox = useDropbox();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExerciseType | 'all'>('all');
  const q = useDeferredValue(query);
  const [menuFor, setMenuFor] = useState<Page | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const byPage = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of memos ?? []) map.set(m.pageId, [...(map.get(m.pageId) ?? []), m.label]);
    return map;
  }, [memos]);

  // One chip per exercise that has at least one page. A filter whose pages are gone falls back to All.
  const types = useMemo(() => EXERCISES.filter((e) => pages?.some((p) => p.exercise === e.type)), [pages]);
  const active = types.some((t) => t.type === filter) ? filter : 'all';
  const shown = useMemo(
    () =>
      (pages ?? []).filter(
        (p) => (active === 'all' || p.exercise === active) && matchesQuery(searchText(p, byPage.get(p.id) ?? []), q),
      ),
    [pages, byPage, q, active],
  );

  const memoTotal = (pages ?? []).reduce((n, p) => n + (byPage.get(p.id)?.length ?? 0), 0);
  const banner =
    pages && settings
      ? backupBanner({
          now,
          // A Dropbox backup counts as a backup.
          lastBackupAt: Math.max(settings.lastBackupAt ?? 0, dropbox?.state.lastSyncAt ?? 0) || null,
          dismissedAt: settings.backupBannerDismissedAt,
          pages,
        })
      : null;

  const archive = (page: Page) => {
    setMenuFor(null);
    void setArchived(page.id, true);
    toast({ text: 'Page archived', action: { label: 'Undo', run: () => void setArchived(page.id, false) } });
  };

  const freePage = async () => {
    const page = await createPage('free');
    navigate(`/page/${page.id}`);
  };

  if (!pages) return <main className="screen" />;

  return (
    <main className="screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Margins</h1>
          <p className="screen-sub">
            {plural(pages.length, 'page')} · {plural(memoTotal, 'memo')}
          </p>
        </div>
        <div className="screen-head__actions">
          <Link to="/settings" className="icon-btn" aria-label="Settings">
            <GearIcon />
          </Link>
          <Link to="/exercises" className="round-btn" aria-label="New page">
            <PlusIcon />
          </Link>
        </div>
      </header>

      {banner && (
        <div className="banner" role="status">
          <Link to="/settings" className="banner__text">
            {banner}
          </Link>
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss"
            onClick={() => void setSetting('backupBannerDismissedAt', Date.now())}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="search">
          <label className="search__box">
            <SearchIcon />
            <input
              type="search"
              className="search__input"
              placeholder="Search lyrics, words, memos"
              aria-label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      )}

      {types.length > 1 && (
        <div className="filters" role="radiogroup" aria-label="Filter by exercise">
          {[{ type: 'all' as const, name: 'All' }, ...types].map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={active === t.type}
              className={active === t.type ? 'filter-chip filter-chip--on' : 'filter-chip'}
              onClick={() => setFilter(t.type)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {pages.length === 0 ? (
        <div className="empty-card">
          <p>No pages yet. Pick an exercise or start a free page.</p>
          <div className="empty-card__row">
            <Link to="/exercises" className="btn">
              Pick an exercise
            </Link>
            <button type="button" className="btn btn--primary" onClick={() => void freePage()}>
              Free page
            </button>
          </div>
        </div>
      ) : (
        <div className="page-list">
          {shown.map((p) => (
            <PageCard
              key={p.id}
              page={p}
              memoCount={byPage.get(p.id)?.length ?? 0}
              onLongPress={setMenuFor}
              onArchive={archive}
            />
          ))}
          {shown.length === 0 && <p className="placeholder">Nothing matches "{query.trim()}".</p>}
        </div>
      )}

      {menuFor && (
        <Sheet label="Page options" onClose={() => setMenuFor(null)}>
          <SheetButton onClick={() => archive(menuFor)}>Archive page</SheetButton>
        </Sheet>
      )}
    </main>
  );
}
