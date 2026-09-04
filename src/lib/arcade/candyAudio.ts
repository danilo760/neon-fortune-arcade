export type CandySound = "pop" | "break" | "bounce" | "bomb" | "explosion" | "streak";

let context: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(freq: number, end: number, duration: number, gain: number, delay = 0) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(end, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCandySound(name: CandySound, enabled: boolean) {
  if (!enabled) return;
  const variation = 0.97 + Math.random() * 0.06;
  switch (name) {
    case "pop":
      tone(620 * variation, 980 * variation, 0.11, 0.026);
      break;
    case "break":
      tone(880 * variation, 410 * variation, 0.14, 0.03);
      tone(1240 * variation, 700 * variation, 0.09, 0.018, 0.025);
      break;
    case "bounce":
      tone(320 * variation, 520 * variation, 0.12, 0.024);
      break;
    case "bomb":
      tone(210, 680, 0.34, 0.036);
      tone(440, 1120, 0.25, 0.025, 0.08);
      break;
    case "explosion":
      tone(180, 72, 0.28, 0.045);
      tone(1320, 420, 0.13, 0.025, 0.01);
      break;
    case "streak":
      [520, 660, 820].forEach((freq, index) => tone(freq * variation, freq * 1.2 * variation, 0.14, 0.024, index * 0.045));
      break;
  }
}
