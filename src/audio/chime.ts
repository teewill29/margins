// The object-writing timer's chime: generated with Web Audio, no audio file.
// iOS only lets a page make sound after a tap, so `unlockAudio` runs on the timer tap.

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && Ctor) ctx = new Ctor();
    void ctx?.resume().catch(() => {});
  } catch {
    // No audio: the timer still shows "Time".
  }
}

/** One soft bell: two partials with a slow decay. */
export function playChime(): void {
  if (!ctx) return;
  void ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.02;
  for (const [freq, gain] of [[880, 0.22], [1318.5, 0.1], [440, 0.08]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 2.7);
  }
}
