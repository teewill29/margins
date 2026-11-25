import type { ReactNode } from 'react';
import { hashString } from '../lib/random';

/** Stable tilt between -0.6 and 0.6 degrees for an id, never random per render (DESIGN.md). */
export function tiltFor(id: string): number {
  return ((hashString(id) % 13) - 6) / 10;
}

export function IndexCard({ id, tape = true, children }: { id: string; tape?: boolean; children: ReactNode }) {
  return (
    <section className="index-card" style={{ transform: `rotate(${tiltFor(id)}deg)` }}>
      {tape && <div className="index-card__tape" aria-hidden="true" style={{ transform: `rotate(${tiltFor(`${id}:tape`) * 4}deg)` }} />}
      {children}
    </section>
  );
}
