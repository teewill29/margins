// The pad that's on screen registers here so the recording dock can read the caret line
// and Copy lyrics can read unsaved text. Plain module state: there is only ever one pad.
import type { Pin } from '../lib/pins';

export interface ActivePad {
  pageId: string;
  caret(): Pin;
  text(): string;
  flush(): Promise<void>;
  focusEnd(): void;
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
