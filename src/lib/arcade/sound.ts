/**
 * Lightweight procedural WebAudio engine.
 * No commercial audio assets, no downloads, and no autoplay before interaction.
 */

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

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  endFreq?: number,
) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4200, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter).connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration: number, gain: number, delay = 0, cutoff = 1800) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, start);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter).connect(amp).connect(audio.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export type SoundName =
  | "spin"
  | "tick"
  | "anticipation"
  | "win"
  | "bigWin"
  | "lose"
  | "click"
  | "cash"
  | "bonus";

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "spin":
      noise(0.22, 0.02, 0, 1200);
      tone(150, 0.2, "sawtooth", 0.035, 0, 290);
      tone(330, 0.12, "triangle", 0.035, 0.055, 480);
      break;
    case "tick":
      tone(980, 0.045, "square", 0.018, 0, 720);
      tone(1450, 0.035, "sine", 0.012, 0.008, 1050);
      break;
    case "anticipation":
      tone(132, 0.34, "sine", 0.042, 0, 168);
      tone(264, 0.2, "triangle", 0.028, 0.08, 352);
      tone(420, 0.16, "sine", 0.025, 0.18, 620);
      noise(0.25, 0.008, 0.08, 900);
      break;
    case "click":
      tone(560, 0.055, "triangle", 0.03, 0, 720);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone(frequency, 0.2, index % 2 === 0 ? "triangle" : "sine", 0.048, index * 0.07, frequency * 1.03);
      });
      break;
    case "bigWin":
      noise(0.3, 0.012, 0, 3200);
      [392, 523, 659, 784, 1046, 1318].forEach((frequency, index) => {
        tone(frequency, 0.28, "triangle", 0.055, index * 0.075, frequency * 1.08);
      });
      break;
    case "bonus":
      noise(0.42, 0.014, 0, 3600);
      [392, 523, 659, 784, 1046, 1318, 1568].forEach((frequency, index) => {
        tone(frequency, 0.32, index % 2 === 0 ? "triangle" : "sine", 0.058, index * 0.065, frequency * 1.1);
      });
      tone(196, 0.55, "sine", 0.04, 0.06, 392);
      break;
    case "cash":
      [659, 880, 1174].forEach((frequency, index) => {
        tone(frequency, 0.18, "sine", 0.045, index * 0.055, frequency * 1.04);
      });
      break;
    case "lose":
      noise(0.16, 0.018, 0, 650);
      tone(260, 0.2, "sawtooth", 0.035, 0, 155);
      tone(180, 0.28, "sine", 0.035, 0.075, 110);
      break;
  }
}
