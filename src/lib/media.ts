/** Recording formats in order of preference (SPEC.md). */
export const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'] as const;

/** First supported recording type, or '' to let the browser choose. */
export function pickMimeType(isSupported: (type: string) => boolean): string {
  return RECORDING_TYPES.find((t) => isSupported(t)) ?? '';
}

/** Loudness 0..1 from AnalyserNode time-domain bytes (128 = silence). */
export function levelFromBytes(bytes: ArrayLike<number>): number {
  if (bytes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = ((bytes[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / bytes.length) * 3);
}
