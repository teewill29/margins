import { createContext, useContext, type ReactNode } from 'react';

export const PanelCollapse = createContext<{ collapsed: boolean; toggle(): void } | null>(null);

/** An exercise card's red label. Tapping it folds the card to one line (SPEC: panel collapse). */
export function PanelLabel({ children }: { children: ReactNode }) {
  const c = useContext(PanelCollapse);
  if (!c) return <span className="card-label">{children}</span>;
  return (
    <button type="button" className="card-label card-label--btn" aria-expanded={!c.collapsed} onClick={c.toggle}>
      {children}
      <svg className="card-label__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={c.collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
      </svg>
    </button>
  );
}
