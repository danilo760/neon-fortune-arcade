/** Tiny WebAudio blip engine — no assets, no dependencies. */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export type SoundName = "spin" | "tick" | "win" | "bigWin" | "lose" | "click" | "cash";

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "spin":
      tone(180, 0.18, "sawtooth", 0.05);
      tone(320, 0.12, "triangle", 0.04, 0.05);
      break;
    case "tick":
      tone(880, 0.05, "square", 0.025);
      break;
    case "click":
      tone(520, 0.06, "triangle", 0.04);
      break;
    case "win":
      [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.06, i * 0.08));
      break;
    case "bigWin":
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, i * 0.09));
      break;
    case "cash":
      [784, 1046].forEach((f, i) => tone(f, 0.18, "sine", 0.06, i * 0.07));
      break;
    case "lose":
      tone(220, 0.25, "sawtooth", 0.05);
      tone(150, 0.3, "sine", 0.05, 0.08);
      break;
  }
}
