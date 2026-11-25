import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MemoPill, useMemoSheet } from '../components/Memos';
import { MoreIcon } from '../components/Icons';
import { RuledPad } from '../components/RuledPad';
import { PromptSheet, Sheet, SheetButton } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { db } from '../db/db';
import { renamePage, setArchived } from '../db/pages';
import type { Memo, Page as PageRow } from '../db/types';
import { useActiveTime } from '../hooks/useActiveTime';
import { pageTitleDate } from '../lib/date';
import { exerciseName } from '../lib/exercises';
import { activeMinutes } from '../lib/format';
import { activePad } from '../state/padRegistry';
import { useToast } from '../state/toast';

export function Page() {
  const { id = '' } = useParams();
  const page = useLiveQuery(async () => (await db.pages.get(id)) ?? null, [id]);
  const memos = useLiveQuery(() => db.memos.where('pageId').equals(id).sortBy('createdAt'), [id], [] as Memo[]);
  useActiveTime(page ? id : undefined);

  if (page === undefined) return <main className="screen" />;
  if (page === null) {
    return (
      <main className="screen">
        <TopBar title="Page not found" back="/" backLabel="Back to notebook" />
        <p className="placeholder">This page isn't in the notebook. It may be on another device.</p>
      </main>
    );
  }
  return <PageView page={page} memos={memos} />;
}

function PageView({ page, memos }: { page: PageRow; memos: Memo[] }) {
  const [menu, setMenu] = useState<'menu' | 'rename' | null>(null);
  const memoSheet = useMemoSheet();
  const toast = useToast();
  const navigate = useNavigate();
  const minutes = activeMinutes(page.activeMs);
  const sub = [exerciseName(page.exercise), minutes].filter(Boolean).join(' · ');

  const copyLyrics = async () => {
    setMenu(null);
    const text = (activePad()?.text() ?? page.body).trim();
    try {
      await navigator.clipboard.writeText(text);
      toast({ text: 'Lyrics copied' });
    } catch {
      toast({ text: "Couldn't copy. Select the text and copy it instead." });
    }
  };

  const archive = async () => {
    setMenu(null);
    await activePad()?.flush();
    await setArchived(page.id, true);
    navigate('/');
    toast({ text: 'Page archived', action: { label: 'Undo', run: () => void setArchived(page.id, false) } });
  };

  return (
    <main className="screen screen--page">
      <TopBar
        title={page.title ?? pageTitleDate(page.date)}
        sub={sub}
        back="/"
        backLabel="Back to notebook"
        action={
          <button type="button" className="icon-btn" aria-label="Page options" onClick={() => setMenu('menu')}>
            <MoreIcon />
          </button>
        }
      />
      <div
        className="paper"
        onClick={(e) => {
          // A tap on blank paper below the pad starts writing at the end.
          if (e.target === e.currentTarget) activePad()?.focusEnd();
        }}
      >
        <RuledPad key={page.id} pageId={page.id} initialBody={page.body} memos={memos} onMemoMenu={memoSheet.openMenu} />
        {memos.length > 0 && (
          <section className="memo-list" aria-label="Memos">
            <h2 className="memo-list__label">Memos</h2>
            {memos.map((m) => (
              <div className="memo-list__row" key={m.id}>
                <MemoPill memo={m} line={m.pinnedLine} onMenu={memoSheet.openMenu} onRename={memoSheet.openRename} />
              </div>
            ))}
          </section>
        )}
      </div>

      {menu === 'menu' && (
        <Sheet onClose={() => setMenu(null)}>
          <SheetButton onClick={() => setMenu('rename')}>Rename page</SheetButton>
          <SheetButton onClick={() => void copyLyrics()}>Copy lyrics</SheetButton>
          <SheetButton onClick={() => void archive()}>Archive page</SheetButton>
        </Sheet>
      )}
      {menu === 'rename' && (
        <PromptSheet
          title="Rename page"
          label="Page name"
          initial={page.title ?? ''}
          placeholder={pageTitleDate(page.date)}
          onSave={(v) => void renamePage(page.id, v)}
          onClose={() => setMenu(null)}
        />
      )}
      {memoSheet.sheet}
    </main>
  );
}
