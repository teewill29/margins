import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MemoPill, useMemoSheet } from '../components/Memos';
import { MoreIcon } from '../components/Icons';
import { RuledPad, type Range } from '../components/RuledPad';
import { WordGrid } from '../components/WordGrid';
import { ObjectPanel } from '../components/ObjectPanel';
import { ObjectTimer } from '../components/ObjectTimer';
import { TitlePanel } from '../components/TitlePanel';
import { LinePanel } from '../components/LinePanel';
import { DicePanel } from '../components/DicePanel';
import { CharacterPanel } from '../components/CharacterPanel';
import { LadderPanel } from '../components/LadderPanel';
import { CutupPanel } from '../components/CutupPanel';
import { IndexCard } from '../components/IndexCard';
import { PanelCollapse, PanelLabel } from '../components/PanelLabel';
import { promptOf } from '../lib/prompt';
import { loadDice, loadTitles, useContent, type DiceBank, type TitleItem } from '../data/content';
import { chorusLines, titleInChorus, titleWords } from '../lib/titles';
import { useBank, type Bank } from '../data/bank';
import { PromptSheet, Sheet, SheetButton } from '../components/Sheet';
import { TopBar } from '../components/TopBar';
import { db } from '../db/db';
import { renamePage, setArchived, setPageLevel, setPanelCollapsed, setShowSyllables } from '../db/pages';
import type { CharacterState, CutupState, DiceState, GridState, LadderState, Level, LineState, Memo, ObjectState, Page as PageRow, TitleState } from '../db/types';
import { detect, detectWord, type WordResult } from '../lib/detect';
import { useActiveTime } from '../hooks/useActiveTime';
import { useRecordUsed } from '../hooks/useRecordUsed';
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

const DETECTS = new Set(['grid', 'ladder', 'title']);

/** A ladder's 16 words and overrides, shaped like a grid's for detection. */
const ladderCache = new WeakMap<LadderState, { words: string[]; overrides: GridState['overrides'] }>();
function ladderAsGrid(l: LadderState) {
  let g = ladderCache.get(l);
  if (!g) ladderCache.set(l, (g = { words: [...l.nouns, ...l.verbs], overrides: l.overrides }));
  return g;
}

interface Banks {
  bank: Bank | null;
  titles: readonly TitleItem[] | null;
  dice: DiceBank | null;
}

/** The exercise words to look for on this page, with their forms. */
function useTargets(page: PageRow, { bank, titles, dice }: Banks) {
  const grid = page.exercise === 'grid' ? (page.state as GridState) : page.exercise === 'ladder' ? ladderAsGrid(page.state as LadderState) : null;
  const title = page.exercise === 'title' ? (page.state as TitleState).title : null;
  const banned = page.exercise === 'dice' ? (page.state as DiceState).banned : null;
  const gridKey = grid?.words.join(',') ?? '';
  const words = useMemo(() => {
    if (gridKey && bank) return gridKey.split(',').map((w) => detectWord(w, bank.byW.get(w)?.forms ?? []));
    if (banned) return [detectWord(banned, dice?.banned.find((b) => b.w === banned)?.forms ?? [])];
    if (title) {
      const entry = titles?.find((t) => t.text === title);
      return entry ? entry.words.map((x) => detectWord(x.w, x.forms)) : titleWords(title).map((w) => detectWord(w, []));
    }
    return [];
  }, [gridKey, title, banned, bank, titles, dice]);
  return { words, overrides: grid?.overrides };
}

const NO_OVERRIDES = {};

/** One line for a folded exercise card. */
function panelSummary(page: PageRow, results: readonly WordResult[]): string {
  const used = results.filter((r) => r.used).length;
  switch (page.exercise) {
    case 'grid':
    case 'ladder':
      return `${used} of ${results.length} used`;
    case 'title':
      return (page.state as TitleState).title;
    case 'cutup':
      return (page.state as CutupState).source ? 'Scraps ready' : 'No text yet';
    default:
      return promptOf(page.exercise, page.state) ?? '';
  }
}

/** Detection for the page's exercise words, recomputed as the text changes. */
function useDetection(page: PageRow, text: string, banks: Banks): WordResult[] {
  const { words, overrides } = useTargets(page, banks);
  // The banned word is flagged in any form, whatever the page's level (SPEC: Root matching).
  const level = page.exercise === 'dice' ? 'root' : page.level;
  return useMemo(() => detect(text, words, level, overrides ?? NO_OVERRIDES), [text, words, level, overrides]);
}

function PageView({ page, memos }: { page: PageRow; memos: Memo[] }) {
  const [menu, setMenu] = useState<'menu' | 'rename' | 'level' | null>(null);
  const [text, setText] = useState(page.body);
  const bank = useBank();
  const titles = useContent(page.exercise === 'title' ? loadTitles : null);
  const dice = useContent(page.exercise === 'dice' ? loadDice : null);
  const usesBank = page.exercise === 'grid' || page.exercise === 'ladder';
  const results = useDetection(page, text, { bank: usesBank ? bank : null, titles, dice });
  useRecordUsed(page.id, results, usesBank && bank !== null);
  const chorus = useMemo(() => (page.exercise === 'title' ? chorusLines(text) : new Set<number>()), [page.exercise, text]);
  const titleWordsInChorus = results.filter((r) => r.matches.some((m) => chorus.has(m.line))).length;
  const collapse = useMemo(
    () => ({ collapsed: page.panelCollapsed, toggle: () => void setPanelCollapsed(page.id, !page.panelCollapsed) }),
    [page.id, page.panelCollapsed],
  );
  const highlights = useMemo(() => {
    const map = new Map<number, Range[]>();
    const kind = page.exercise === 'dice' ? 'banned' : 'mark';
    for (const r of results) for (const m of r.matches) map.set(m.line, [...(map.get(m.line) ?? []), { start: m.start, end: m.end, kind }]);
    return map;
  }, [results, page.exercise]);
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
      {page.exercise !== 'free' && (
        <PanelCollapse.Provider value={collapse}>
          {page.panelCollapsed ? (
            <IndexCard id={page.id}>
              <div className="panel-head panel-head--collapsed">
                <PanelLabel>{exerciseName(page.exercise)}</PanelLabel>
                <span className="panel-summary">{panelSummary(page, results)}</span>
              </div>
            </IndexCard>
          ) : (
            <>
    {page.exercise === 'object' && <ObjectPanel pageId={page.id} state={page.state as ObjectState} />}
    {(page.exercise === 'firstLine' || page.exercise === 'lastLine') && (
      <LinePanel pageId={page.id} kind={page.exercise === 'firstLine' ? 'first' : 'last'} state={page.state as LineState} />
    )}
    {page.exercise === 'ladder' &&
      (bank ? (
        <LadderPanel pageId={page.id} state={page.state as LadderState} bank={bank} results={results} />
      ) : (
        <div className="index-card index-card--loading" aria-busy="true" />
      ))}
    {page.exercise === 'cutup' && <CutupPanel pageId={page.id} state={page.state as CutupState} />}
    {page.exercise === 'character' && <CharacterPanel pageId={page.id} state={page.state as CharacterState} />}
    {page.exercise === 'dice' && <DicePanel pageId={page.id} state={page.state as DiceState} bannedUses={results[0]?.matches.length ?? 0} />}
    {page.exercise === 'title' && (
      <TitlePanel
        pageId={page.id}
        state={page.state as TitleState}
        inChorus={titleInChorus(results, chorus) ? results.length : titleWordsInChorus}
        total={results.length}
      />
    )}
    {page.exercise === 'grid' &&
      (bank ? (
        <WordGrid pageId={page.id} date={page.date} state={page.state as GridState} bank={bank} results={results} />
      ) : (
        <div className="index-card index-card--loading" aria-busy="true" />
      ))}
            </>
          )}
        </PanelCollapse.Provider>
      )}
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
        <Sheet label="Page options" onClose={() => setMenu(null)}>
          <SheetButton onClick={() => setMenu('rename')}>Rename page</SheetButton>
          {DETECTS.has(page.exercise) && (
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
