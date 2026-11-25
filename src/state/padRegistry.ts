// The pad that's on screen registers here so the recording dock can read the caret line
// and Copy lyrics can read unsaved text. Plain module state: there is only ever one pad.
import type { Pin } from '../lib/pins';

export interface ActivePad {
  pageId: string;
  caret(): Pin;
  text(): string;
  flush(): Promise<void>;
  focusEnd(): void;
  /** Replaces line 0 if it still reads `oldText`. Returns false if the user changed it. */
  replaceFirstLine(oldText: string, newText: string): boolean;
  /** Inserts text at the caret (or at the end if the pad was never focused). */
  insertAtCaret(text: string): void;
}

let active: ActivePad | null = null;

export function registerPad(pad: ActivePad): () => void {
  active = pad;
  return () => {
    if (active === pad) active = null;
  };
}

export function activePad(): ActivePad | null {
  return active;
}
