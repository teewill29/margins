import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import type { Page } from '../db/types';
import { useLongPress } from '../hooks/useLongPress';
import { relativeDay } from '../lib/date';
import { exerciseName } from '../lib/exercises';
import { previewLines } from '../lib/pad';
import { SmallMicIcon } from './Icons';

const SWIPE_ARCHIVE_PX = 96;

/** First lines of a page for its card, falling back to the prompt. */
function cardLines(page: Page): [string, string] {
  const lines = previewLines(page.body, 2);
  const s = page.state as Record<string, unknown>;
  const prompt = [s.object, s.line, s.title].find((v): v is string => typeof v === 'string' && v.length > 0);
  const first = page.title ?? lines[0] ?? prompt ?? 'Empty page';
  const second = page.title ? (lines[0] ?? '') : (lines[1] ?? '');
  return [first, second];
}

interface PageCardProps {
  page: Page;
  memoCount: number;
  onLongPress(page: Page): void;
  onArchive(page: Page): void;
}

export function PageCard({ page, memoCount, onLongPress, onArchive }: PageCardProps) {
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const swiped = useRef(false);
  const lp = useLongPress(() => onLongPress(page));
  const [first, second] = cardLines(page);

  const down = (e: PointerEvent<HTMLAnchorElement>) => {
    lp.handlers.onPointerDown(e);
    swiped.current = false;
    drag.current = { x: e.clientX, y: e.clientY, swiping: false };
  };
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    lp.handlers.onPointerMove(e);
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.swiping && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) {
      d.swiping = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (d.swiping) setDx(Math.min(0, mx));
  };
  const up = () => {
    lp.handlers.onPointerUp();
    const d = drag.current;
    drag.current = null;
    if (d?.swiping) {
      swiped.current = true;
      if (dx < -SWIPE_ARCHIVE_PX) onArchive(page);
    }
    setDx(0);
  };

  return (
    <div className="page-card-wrap">
      <div className="page-card__under" aria-hidden="true">
        Archive
      </div>
      <Link
        to={`/page/${page.id}`}
        className="page-card"
        style={dx ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={lp.handlers.onContextMenu}
        onClick={(e) => {
          if (lp.consumeClick() || swiped.current) e.preventDefault();
          swiped.current = false;
        }}
      >
        <span className="page-card__first">{first}</span>
        {second && <span className="page-card__second">{second}</span>}
        <span className="page-card__meta">
          <span className="page-card__tag">{exerciseName(page.exercise)}</span>
          <span>{relativeDay(page.date)}</span>
          <span className="page-card__memos" aria-label={`${memoCount} memos`}>
            <SmallMicIcon />
            {memoCount}
          </span>
        </span>
      </Link>
    </div>
  );
}
