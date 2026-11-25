import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { savePageBody } from '../db/pages';
import type { Memo } from '../db/types';
import { labelText, lineAt, splitLines } from '../lib/pad';
import { resolvePin } from '../lib/pins';
import { isIOS } from '../platform';
import { registerPad } from '../state/padRegistry';
import { useToast } from '../state/toast';
import { GutterPlay } from './Memos';

interface RuledPadProps {
  pageId: string;
  initialBody: string;
  memos: readonly Memo[];
  onMemoMenu(memo: Memo): void;
}

const SAVE_MS = 500;
const IOS = isIOS();

/**
 * The writing pad: a transparent <textarea> over a mirror <div> that draws the same text with
 * section labels (and, from Phase 2, highlights). Both must lay text out identically, so they
 * share every font, size, padding and wrapping rule in app.css (.pad__mirror, .pad__input).
 * The mirror sets the height; the textarea fills it and never scrolls on its own.
 */
export function RuledPad({ pageId, initialBody, memos, onMemoMenu }: RuledPadProps) {
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
          const label = labelText(line);
          const pinned = pinnedAt.get(i);
          return (
            <div key={i} className={label ? 'pad__line pad__line--label' : 'pad__line'}>
              {label && caretLine !== i ? (
                <>
                  <span className="pad__ghost">{line}</span>
                  <span className="pad__label">{label}</span>
                </>
              ) : (
                line || '​'
              )}
              {pinned && (
                <span className="pad__gutter">
                  <GutterPlay memo={pinned} onMenu={onMemoMenu} />
                </span>
              )}
            </div>
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
