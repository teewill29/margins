import { describe, expect, it } from 'vitest';
import { hashString } from './hash';
import { base64url, challengeFor, randomVerifier } from './pkce';
import { snapshotName, snapshotsToDelete } from './snapshots';

describe('hashString', () => {
  it('is stable and sensitive to changes', () => {
    expect(hashString('porch')).toBe(hashString('porch'));
    expect(hashString('porch')).not.toBe(hashString('porch '));
    expect(hashString('porch', 1)).not.toBe(hashString('porch'));
  });
});

describe('pkce', () => {
  it('makes URL-safe verifiers of 64 characters', () => {
    const v = randomVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(randomVerifier()).not.toBe(v);
  });
  it('base64url-encodes without padding', () => {
    expect(base64url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
    expect(base64url(new Uint8Array([1]))).toBe('AQ');
  });
  it('matches the RFC 7636 example challenge', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('snapshots', () => {
  it('names snapshots by date', () => {
    expect(snapshotName('2026-11-25')).toBe('margins-2026-11-25.json');
  });
  it('keeps the newest 30 and leaves other files alone', () => {
    const names = Array.from({ length: 33 }, (_, i) => snapshotName(`2026-10-${String(i + 1).padStart(2, '0')}`));
    names.push('notes.txt');
    expect(snapshotsToDelete(names)).toEqual(['margins-2026-10-03.json', 'margins-2026-10-02.json', 'margins-2026-10-01.json']);
    expect(snapshotsToDelete(names.slice(0, 5))).toEqual([]);
  });
});
