let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audioCtx ??= new AudioContext();
    return audioCtx;
  } catch {
    return null;
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
