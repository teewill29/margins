import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastInput {
  text: string;
  action?: { label: string; run: () => void };
  ms?: number;
}
interface Toast extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const nextId = useRef(1);

  const show = useCallback((t: ToastInput) => {
    window.clearTimeout(timer.current);
    const id = nextId.current++;
    setToast({ ...t, id });
    timer.current = window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.ms ?? 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-slot" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span className="toast__text">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
