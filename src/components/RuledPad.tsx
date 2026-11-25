import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { savePageBody } from '../db/pages';
import type { Memo } from '../db/types';
import { labelText, lineAt, splitLines } from '../lib/pad';
import { resolvePin } from '../lib/pins';
import { countLine } from '../lib/syllables';
import { isIOS } from '../platform';
import { registerPad } from '../state/padRegistry';
import { useToast } from '../state/toast';
import { GutterPlay } from './Memos';

interface RuledPadProps {
  pageId: string;
  initialBody: string;
  memos: readonly Memo[];
  audioUrls: ReadonlyMap<string, string>;
  onMemoMenu(memo: Memo): void;
  /** Marker highlights per line: character ranges within the line. */
  highlights?: ReadonlyMap<number, readonly Range[]>;
  showSyllables?: boolean;
  onTextChange?(text: string): void;
}

export interface Range {
  start: number;
  end: number;
  /** "mark": a used exercise word (marker). "banned": the dice's banned word (red underline). */
  kind?: 'mark' | 'banned';
}

interface MirrorLineProps {
  line: string;
  /** Show the line as typed (the caret is on it), so a label shows its brackets. */
  raw: boolean;
  ranges: readonly Range[] | undefined;
  syl: number | null;
  pinned: Memo | undefined;
  url: string | undefined;
  onMemoMenu(memo: Memo): void;
}

const sameRanges = (a: readonly Range[] | undefined, b: readonly Range[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((r, i) => r.start === b[i]?.start && r.end === b[i]?.end && r.kind === b[i]?.kind));

/** One line of the mirror. Re-renders only when its own content changes, so long pages stay fast. */
const MirrorLine = memo(
  function MirrorLine({ line, raw, ranges, syl, pinned, url, onMemoMenu }: MirrorLineProps) {
    const label = labelText(line);
    return (
      <div className={label ? 'pad__line pad__line--label' : 'pad__line'}>
        {syl !== null && <span className="pad__syl">{syl}</span>}
        {label && !raw ? (
          <>
            <span className="pad__ghost">{line}</span>
            <span className="pad__label">{label}</span>
          </>
        ) : (
          marked(line, ranges)
        )}
        {pinned && (
          <span className="pad__gutter">
            <GutterPlay memo={pinned} url={url} onMenu={onMemoMenu} />
          </span>
        )}
      </div>
    );
  },
  (a, b) =>
    a.line === b.line && a.raw === b.raw && a.syl === b.syl && a.pinned === b.pinned && a.url === b.url &&
    a.onMemoMenu === b.onMemoMenu && sameRanges(a.ranges, b.ranges),
);

/** A line's text with marker spans. No padding on the spans: the mirror must keep the textarea's layout. */
function marked(line: string, ranges: readonly Range[] | undefined): string | (string | ReactElement)[] {
  if (!ranges?.length) return line || '\u200b';
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: (string | ReactElement)[] = [];
  const seen = new Map<string, number>();
  let at = 0;
  sorted.forEach((r) => {
    if (r.start < at) return;
    if (r.start > at) out.push(line.slice(at, r.start));
    const word = line.slice(r.start, r.end);
    // Keyed by the word (and its count so far), so marks keep their identity while the line is
    // edited around them, and only a newly used word plays the marker sweep.
    const n = (seen.get(word) ?? 0) + 1;
    seen.set(word, n);
    out.push(
      <mark key={`${word}#${n}`} className={r.kind === 'banned' ? 'pad__banned' : 'pad__mark'}>
        {word}
      </mark>,
    );
    at = r.end;
  });
  if (at < line.length) out.push(line.slice(at));
  return out;
}

const SAVE_MS = 500;
const IOS = isIOS();

/**
 * The writing pad: a transparent <textarea> over a mirror <div> that draws the same text with
 * section labels (and, from Phase 2, highlights). Both must lay text out identically, so they
 * share every font, size, padding and wrapping rule in app.css (.pad__mirror, .pad__input).
 * The mirror sets the height; the textarea fills it and never scrolls on its own.
 */
export function RuledPad({ pageId, initialBody, memos, audioUrls, onMemoMenu, highlights, showSyllables = true, onTextChange }: RuledPadProps) {
  const [text, setText] = useState(initialBody);
  const [caretLine, setCaretLine] = useState(-1);
  const input = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef(initialBody);
  const saved = useRef(initialBody);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();

  const retry = useRef<() => void>(() => {});
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const body = textRef.current;
    if (body === saved.current) return;
    try {
      await savePageBody(pageId, body);
      saved.current = body;
    } catch {
      toast({ text: "Couldn't save. Your text is still here.", action: { label: 'Retry', run: () => retry.current() }, ms: 30_000 });
    }
  }, [pageId, toast]);
  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  // Save on hide and when leaving the page.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [flush]);

  useEffect(
    () =>
      registerPad({
        pageId,
        caret: () => {
          const el = input.current;
          const body = textRef.current;
          const line = lineAt(body, el ? el.selectionStart : body.length);
          return { line, text: splitLines(body)[line] ?? '' };
        },
        text: () => textRef.current,
        flush,
        focusEnd: () => {
          const el = input.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        },
        // Edits go through the textarea and an input event, so React's onChange, autosave and
        // pins all see them like typing.
        replaceFirstLine: (oldText, newText) => {
          const el = input.current;
          const first = el?.value.split('\n')[0];
          if (!el || first !== oldText) return false;
          el.setRangeText(newText, 0, first.length, 'preserve');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        },
        insertAtCaret: (text) => {
          const el = input.current;
          if (!el) return;
          const touched = document.activeElement === el || el.selectionStart !== 0 || el.value.length === 0;
          const start = touched ? el.selectionStart : el.value.length;
          const end = touched ? el.selectionEnd : el.value.length;
          // A space between an inserted phrase and the word before it.
          const before = el.value[start - 1];
          const glue = before && !/\s/.test(before) ? ' ' : '';
          el.setRangeText(glue + text, start, end, 'end');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.focus({ preventScroll: true });
        },
      }),
    [pageId, flush],
  );

  const syncCaret = () => {
    const el = input.current;
    if (el && document.activeElement === el) setCaretLine(lineAt(el.value, el.selectionStart));
  };

  const lines = useMemo(() => splitLines(text), [text]);

  // Where each pinned memo sits right now (the database copy catches up on save).
  const pinnedAt = useMemo(() => {
    const map = new Map<number, Memo>();
    for (const m of memos) {
      const pin = resolvePin(lines, m.pinnedLine, m.pinnedText);
      if (pin && !map.has(pin.line)) map.set(pin.line, m);
    }
    return map;
  }, [memos, lines]);

  return (
    <div className={IOS ? 'pad pad--ios' : 'pad'}>
      <div className="pad__mirror" aria-hidden="true">
        {lines.map((line, i) => {
          const pinned = pinnedAt.get(i);
          return (
            <MirrorLine
              key={i}
              line={line}
              raw={caretLine === i}
              ranges={highlights?.get(i)}
              syl={showSyllables ? countLine(line) : null}
              pinned={pinned}
              url={pinned ? audioUrls.get(pinned.id) : undefined}
              onMemoMenu={onMemoMenu}
            />
          );
        })}
      </div>
      <textarea
        ref={input}
        className="pad__input"
        aria-label="Lyrics"
        value={text}
        spellCheck
        autoCapitalize="sentences"
        autoCorrect="on"
        onChange={(e) => {
          const v = e.target.value;
          textRef.current = v;
          setText(v);
          onTextChange?.(v);
          setCaretLine(lineAt(v, e.target.selectionStart));
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void flush(), SAVE_MS);
        }}
        onSelect={syncCaret}
        onFocus={syncCaret}
        onBlur={() => {
          setCaretLine(-1);
          void flush();
        }}
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
        }}
      />
    </div>
  );
}
