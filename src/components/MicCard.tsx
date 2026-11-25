import { useRecorder } from '../state/recorder';
import { CloseIcon } from './Icons';

const COPY = {
  denied: {
    title: "Margins can't use the mic",
    body: "Allow the microphone for this site in your browser settings, then tap Record again. On iPhone: Settings, then Apps, then Safari, then Microphone.",
  },
  unsupported: {
    title: "Recording isn't supported here",
    body: "This browser can't record audio. Try Safari on iPhone or Chrome on a computer.",
  },
  failed: {
    title: "The mic didn't start",
    body: "Check that no other app is using the microphone, then tap Record again.",
  },
} as const;

export function MicCard() {
  const { error, clearError } = useRecorder();
  if (!error) return null;
  const c = COPY[error];
  return (
    <div className="mic-card" role="alert">
      <div>
        <p className="mic-card__title">{c.title}</p>
        <p className="mic-card__body">{c.body}</p>
      </div>
      <button type="button" className="icon-btn" aria-label="Dismiss" onClick={clearError}>
        <CloseIcon />
      </button>
    </div>
  );
}

/** Recordings the app couldn't store. Stays until each is saved or exported. */
export function UnsavedCard() {
  const { unsaved, retryUnsaved, exportUnsaved } = useRecorder();
  const first = unsaved[0];
  if (!first) return null;
  return (
    <div className="mic-card" role="alert">
      <div>
        <p className="mic-card__title">
          {unsaved.length === 1 ? "A recording isn't saved yet" : `${unsaved.length} recordings aren't saved yet`}
        </p>
        <p className="mic-card__body">The app couldn't store it. Try again, or save it as a file so it's safe.</p>
        <div className="mic-card__row">
          <button type="button" className="btn btn--small" onClick={() => void retryUnsaved()}>
            Try again
          </button>
          <button type="button" className="btn btn--small btn--primary" onClick={() => void exportUnsaved(first)}>
            Save file
          </button>
        </div>
      </div>
    </div>
  );
}
