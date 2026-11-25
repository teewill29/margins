import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MemoPill, useMemoSheet } from '../components/Memos';
import { MoreIcon } from '../components/Icons';
import { RuledPad, type Range } from '../components/RuledPad';
import { WordGrid } from '../components/WordGrid';
import { ObjectPanel } from '../components/ObjectPanel';
import { ObjectTimer } from '../components/ObjectTimer';
import { useBank, type Bank } from '../data/bank';
import { PromptSheet, Sheet, SheetButton } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { db } from '../db/db';
import { renamePage, setArchived, setPageLevel, setShowSyllables } from '../db/pages';
import type { GridState, Level, Memo, ObjectState, Page as PageRow } from '../db/types';
import { detect, detectWord, type WordResult } from '../lib/detect';
import { useActiveTime } from '../hooks/useActiveTime';
import { useAudioUrls } from '../state/player';
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

const LEVELS: [Level, string, string][] = [
  ['exact', 'Exact', 'Only the word itself.'],
  ['root', 'Root', 'Any form: burn, burned, burnt, burning.'],
  ['loose', 'Loose', 'Also near misses: rusty for rust, porchlight for porch.'],
];

/** Detection for the page's exercise words, recomputed as the text changes. */
function useDetection(page: PageRow, text: string, bank: Bank | null): WordResult[] {
  const grid = page.exercise === 'grid' ? (page.state as GridState) : null;
  const key = grid?.words.join(',') ?? '';
  const words = useMemo(
    () => (bank && key ? key.split(',').map((w) => detectWord(w, bank.byW.get(w)?.forms ?? [])) : []),
    [bank, key],
  );
  return useMemo(() => detect(text, words, page.level, grid?.overrides ?? {}), [text, words, page.level, grid?.overrides]);
}

function PageView({ page, memos }: { page: PageRow; memos: Memo[] }) {
  const [menu, setMenu] = useState<'menu' | 'rename' | 'level' | null>(null);
  const [text, setText] = useState(page.body);
  const bank = useBank();
  const results = useDetection(page, text, page.exercise === 'grid' ? bank : null);
  const highlights = useMemo(() => {
    const map = new Map<number, Range[]>();
    for (const r of results) for (const m of r.matches) map.set(m.line, [...(map.get(m.line) ?? []), { start: m.start, end: m.end }]);
    return map;
  }, [results]);
  const memoSheet = useMemoSheet();
  const audioUrls = useAudioUrls(memos.map((m) => m.id));
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
          <>
            {page.exercise === 'object' && <ObjectTimer pageId={page.id} state={page.state as ObjectState} />}
            <button type="button" className="icon-btn" aria-label="Page options" onClick={() => setMenu('menu')}>
              <MoreIcon />
            </button>
          </>
        }
      />
      {page.exercise === 'object' && <ObjectPanel pageId={page.id} state={page.state as ObjectState} />}
      {page.exercise === 'grid' &&
        (bank ? (
          <WordGrid pageId={page.id} date={page.date} state={page.state as GridState} bank={bank} results={results} />
        ) : (
          <div className="index-card index-card--loading" aria-busy="true" />
        ))}
      <div
        className="paper"
        onClick={(e) => {
          // A tap on blank paper below the pad starts writing at the end.
          if (e.target === e.currentTarget) activePad()?.focusEnd();
        }}
      >
        <RuledPad
          key={page.id}
          pageId={page.id}
          initialBody={page.body}
          memos={memos}
          audioUrls={audioUrls}
          onMemoMenu={memoSheet.openMenu}
          highlights={highlights}
          showSyllables={page.showSyllables}
          onTextChange={setText}
        />
        {memos.length > 0 && (
          <section className="memo-list" aria-label="Memos">
            <h2 className="memo-list__label">Memos</h2>
            {memos.map((m) => (
              <div className="memo-list__row" key={m.id}>
                <MemoPill memo={m} url={audioUrls.get(m.id)} line={m.pinnedLine} onMenu={memoSheet.openMenu} onRename={memoSheet.openRename} />
              </div>
            ))}
          </section>
        )}
      </div>

      {menu === 'menu' && (
        <Sheet onClose={() => setMenu(null)}>
          <SheetButton onClick={() => setMenu('rename')}>Rename page</SheetButton>
          {page.exercise === 'object' && <ObjectPanel pageId={page.id} state={page.state as ObjectState} />}
      {page.exercise === 'grid' && (
            <SheetButton onClick={() => setMenu('level')}>Detection level: {LEVELS.find((l) => l[0] === page.level)?.[1]}</SheetButton>
          )}
          <SheetButton
            onClick={() => {
              void setShowSyllables(page.id, !page.showSyllables);
              setMenu(null);
            }}
          >
            Syllable counts: {page.showSyllables ? 'On' : 'Off'}
          </SheetButton>
          <SheetButton onClick={() => void copyLyrics()}>Copy lyrics</SheetButton>
          <SheetButton onClick={() => void archive()}>Archive page</SheetButton>
        </Sheet>
      )}
      {menu === 'level' && (
        <Sheet title="Detection level" onClose={() => setMenu(null)}>
          {LEVELS.map(([level, name, hint]) => (
            <SheetButton
              key={level}
              onClick={() => {
                void setPageLevel(page.id, level);
                setMenu(null);
              }}
            >
              <span className="sheet__choice">
                <span>
                  {name}
                  {page.level === level && <span className="sheet__current"> · current</span>}
                </span>
                <span className="sheet__hint">{hint}</span>
              </span>
            </SheetButton>
          ))}
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
