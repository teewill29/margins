import { useState } from 'react';
import { deleteMemo, renameMemo, restoreMemo, unpinMemo } from '../db/memos';
import type { Memo } from '../db/types';
import { formatDuration } from '../lib/format';
import { useLongPress } from '../hooks/useLongPress';
import { usePlayer } from '../state/player';
import { useToast } from '../state/toast';
import { PauseIcon, PlayIcon } from './Icons';
import { PromptSheet, Sheet, SheetButton } from './Sheet';

/** Long-press sheet for a memo: Rename, Unpin, Delete (with undo). */
export function useMemoSheet() {
  const [target, setTarget] = useState<{ memo: Memo; mode: 'menu' | 'rename' } | null>(null);
  const toast = useToast();
  const player = usePlayer();
  const close = () => setTarget(null);

  const sheet = target && (
    target.mode === 'rename' ? (
      <PromptSheet
        title="Rename memo"
        label="Memo name"
        initial={target.memo.label}
        onSave={(v) => void renameMemo(target.memo.id, v)}
        onClose={close}
      />
    ) : (
      <Sheet title={target.memo.label} onClose={close}>
        <SheetButton onClick={() => setTarget({ memo: target.memo, mode: 'rename' })}>Rename</SheetButton>
        {target.memo.pinnedLine !== null && (
          <SheetButton
            onClick={() => {
              void unpinMemo(target.memo.id);
              close();
            }}
          >
            Unpin
          </SheetButton>
        )}
        <SheetButton
          danger
          onClick={async () => {
            close();
            if (player.playingId === target.memo.id) player.stop();
            const gone = await deleteMemo(target.memo.id);
            if (gone) toast({ text: `Deleted ${gone.label}`, action: { label: 'Undo', run: () => void restoreMemo(gone) } });
          }}
        >
          Delete
        </SheetButton>
      </Sheet>
    )
  );

  return {
    sheet,
    openMenu: (memo: Memo) => setTarget({ memo, mode: 'menu' }),
    openRename: (memo: Memo) => setTarget({ memo, mode: 'rename' }),
  };
}

interface PillProps {
  memo: Memo;
  line: number | null;
  onMenu(memo: Memo): void;
  onRename(memo: Memo): void;
}

/** "▶ 0:38 · verse hum". The play part plays, the label renames, long-press opens the menu. */
export function MemoPill({ memo, line, onMenu, onRename }: PillProps) {
  const player = usePlayer();
  const playing = player.playingId === memo.id;
  const lp = useLongPress(() => onMenu(memo));
  return (
    <div className="memo-pill" {...lp.handlers}>
      <button
        type="button"
        className="memo-pill__play"
        aria-label={`${playing ? 'Pause' : 'Play'} ${memo.label}`}
        onClick={() => !lp.consumeClick() && player.toggle(memo)}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        {formatDuration(memo.durationMs)}
      </button>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className="memo-pill__label"
        aria-label={`Rename ${memo.label}`}
        onClick={() => !lp.consumeClick() && onRename(memo)}
      >
        {memo.label}
        {line !== null && <span className="memo-pill__line"> · line {line + 1}</span>}
      </button>
    </div>
  );
}

/** The play button in the pad's right gutter for a pinned memo. */
export function GutterPlay({ memo, onMenu }: { memo: Memo; onMenu(memo: Memo): void }) {
  const player = usePlayer();
  const playing = player.playingId === memo.id;
  const lp = useLongPress(() => onMenu(memo));
  return (
    <button
      type="button"
      className="gutter-play"
      aria-label={`${playing ? 'Pause' : 'Play'} ${memo.label}, ${formatDuration(memo.durationMs)}`}
      {...lp.handlers}
      onClick={() => !lp.consumeClick() && player.toggle(memo)}
    >
      {playing ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
    </button>
  );
}
