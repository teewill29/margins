import { useCallback, useRef, type PointerEvent } from 'react';

/**
 * Long-press (500 ms, finger held still) for touch and mouse, plus right-click.
 * `consumeClick()` returns true once after a long-press so the tap that ends it can be ignored.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    origin.current = null;
  }, []);

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        origin.current = null;
        navigator.vibrate?.(10);
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: { preventDefault(): void }) => {
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
  };

  const consumeClick = useCallback(() => {
    const f = fired.current;
    fired.current = false;
    return f;
  }, []);

  return { handlers, consumeClick, cancel };
}
