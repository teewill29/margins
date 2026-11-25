import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';

interface SheetProps {
  title?: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * Bottom sheet with a backdrop. Escape, the X or a tap outside closes it. Rendered into <body>
 * through a portal: a tilted card (CSS transform) would otherwise trap the fixed backdrop inside it.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, button:not(.sheet__close)') ?? panel.current?.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__head">
          {title && (
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
          )}
          <button type="button" className="icon-btn sheet__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetButton({ children, onClick, danger }: { children: ReactNode; onClick(): void; danger?: boolean }) {
  return (
    <button type="button" className={danger ? 'sheet__btn sheet__btn--danger' : 'sheet__btn'} onClick={onClick}>
      {children}
    </button>
  );
}

interface PromptProps {
  title: string;
  label: string;
  initial: string;
  placeholder?: string;
  onSave(value: string): void;
  onClose(): void;
}

export function PromptSheet({ title, label, initial, placeholder, onSave, onClose }: PromptProps) {
  const [value, setValue] = useState(initial);
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="sheet__form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
          onClose();
        }}
      >
        <input
          className="text-input"
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          enterKeyHint="done"
        />
        <div className="sheet__row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

interface ConfirmProps {
  title: string;
  body: string;
  confirm: string;
  onConfirm(): void;
  onClose(): void;
}

export function ConfirmSheet({ title, body, confirm, onConfirm, onClose }: ConfirmProps) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="sheet__body">{body}</p>
      <div className="sheet__row">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirm}
        </button>
      </div>
    </Sheet>
  );
}
