"use client";

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Play a piano-ish starting pitch for two seconds. */
export function playNote(midiNote: number) {
  const c = audio();
  const t = c.currentTime;
  const f = 440 * Math.pow(2, (midiNote - 69) / 12);
  [1, 2, 3].forEach((harmonic, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f * harmonic;
    const peak = [0.32, 0.08, 0.04][i];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 2.05);
  });
}

/** Four clicks at the given tempo, accent on beat one. */
export function countIn(bpm: number) {
  const c = audio();
  const beat = 60 / bpm;
  const t0 = c.currentTime + 0.05;
  for (let i = 0; i < 4; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = t0 + i * beat;
    o.frequency.value = i === 0 ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.1);
  }
}
