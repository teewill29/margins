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
import { matchesQuery, searchText } from '../lib/search';
import { useToast } from '../state/toast';

export function Notebook() {
  const pages = useLiveQuery(() => db.pages.orderBy('updatedAt').reverse().filter((p) => !p.archived).toArray());
  const memos = useLiveQuery(() => db.memos.toArray());
  const settings = useSettings();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [menuFor, setMenuFor] = useState<Page | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const byPage = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of memos ?? []) map.set(m.pageId, [...(map.get(m.pageId) ?? []), m.label]);
    return map;
  }, [memos]);

  const shown = useMemo(
    () => (pages ?? []).filter((p) => matchesQuery(searchText(p, byPage.get(p.id) ?? []), q)),
    [pages, byPage, q],
  );

  const memoTotal = (pages ?? []).reduce((n, p) => n + (byPage.get(p.id)?.length ?? 0), 0);
  const banner =
    pages && settings
      ? backupBanner({
          now,
          lastBackupAt: settings.lastBackupAt,
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
        <Sheet onClose={() => setMenuFor(null)}>
          <SheetButton onClick={() => archive(menuFor)}>Archive page</SheetButton>
        </Sheet>
      )}
    </main>
  );
}
