let audioCtx: AudioContext | null = null;
let prewarmed = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audioCtx ??= new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Forcefully unlock and warm up the AudioContext so the very first
 * sound after this call has zero perceived latency. Without this, the
 * first coin tink in FinalStage3D fires while the context is still
 * suspended, and the user hears coins land in silence for ~1 second.
 *
 * Plays a tiny silent buffer (1 sample, 0 gain) which is the standard
 * iOS/Safari unlock trick — also schedules a no-op oscillator that
 * gets the audio graph hot so subsequent oscillator allocations are
 * instant. Idempotent: safe to call repeatedly.
 */
export function prewarmAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (prewarmed) return;
  prewarmed = true;

  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);

    // A throwaway oscillator at zero gain — primes the audio graph so the
    // first real coin tink doesn't pay the cold-start cost.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    /* no-op */
  }
}

/** Short metallic UI tap — Web Audio only, no extra assets. */
export function playMetallicClick() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(2600, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.05);

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(1350, t);

  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 0.85;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.055, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.07);
  osc2.stop(t + 0.07);
}

/** Soft pre-tap "tick" played on hover — much quieter than click, so a
 *  busy mouse doesn't fatigue the user. Triangle wave at low volume. */
export function playUiHover() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(1850, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);

  filter.type = "lowpass";
  filter.frequency.value = 4200;
  filter.Q.value = 0.6;

  // Very quiet — barely there but noticeable in a quiet room.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.014, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.08);
}

/** Air whoosh for screen transitions / wipes. Filtered noise burst with
 *  a downward filter sweep — a "swhip" sound. */
export function playWhoosh(opts: { intensity?: "soft" | "normal" | "hard" } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const intensity = opts.intensity ?? "normal";
  const peakGain = intensity === "soft" ? 0.06 : intensity === "hard" ? 0.18 : 0.11;
  const duration = intensity === "soft" ? 0.35 : intensity === "hard" ? 0.6 : 0.45;

  const t = ctx.currentTime;
  const sampleRate = ctx.sampleRate;
  const noiseBuf = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Mostly white noise with a low-frequency wobble for texture.
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(2400, t);
  bp.frequency.exponentialRampToValueAtTime(450, t + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peakGain, t + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  noise.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + duration + 0.02);
}

/** Bright coin "tink" — for landing impacts (coin trail to navbar etc). */
export function playCoinTink(detuneCents: number = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(2950, t);
  osc.detune.value = detuneCents;
  osc.frequency.exponentialRampToValueAtTime(2400, t + 0.18);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(4400, t);
  osc2.detune.value = detuneCents;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.03, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.24);
  osc2.stop(t + 0.24);
}
