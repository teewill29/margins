import { describe, expect, it } from 'vitest';
import { levelFromBytes, pickMimeType } from './media';

describe('pickMimeType', () => {
  it('prefers webm opus, then mp4, then webm', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/mp4' || t === 'audio/webm')).toBe('audio/mp4');
    expect(pickMimeType((t) => t === 'audio/webm')).toBe('audio/webm');
    expect(pickMimeType(() => false)).toBe('');
  });
});

describe('levelFromBytes', () => {
  it('is 0 for silence and grows with loudness', () => {
    expect(levelFromBytes(new Uint8Array(64).fill(128))).toBe(0);
    const quiet = levelFromBytes(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 136 : 120)));
    const loud = levelFromBytes(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 200 : 56)));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThanOrEqual(1);
  });
});
