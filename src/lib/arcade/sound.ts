import { AudioEventGate } from "./audioEventGate";

/**
 * Lightweight procedural WebAudio engine.
 * No commercial audio assets, no downloads, and no autoplay before interaction.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let toneFilter: BiquadFilterNode | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
const cachedCueBuffers = new Map<string, AudioBuffer[]>();
const noiseFilters = new Map<number, BiquadFilterNode>();
const repeatedAudioGate = new AudioEventGate();

function resetGraphCaches() {
  masterGain = null;
  toneFilter = null;
  cachedNoiseBuffer = null;
  cachedCueBuffers.clear();
  noiseFilters.clear();
  repeatedAudioGate.reset();
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx || ctx.state === "closed") {
      ctx = new Ctor();
      resetGraphCaches();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function getMasterGain(audio: AudioContext) {
  if (!masterGain) {
    masterGain = audio.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audio.destination);
  }
  return masterGain;
}

function getToneFilter(audio: AudioContext) {
  if (!toneFilter) {
    toneFilter = audio.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 4200;
    toneFilter.connect(getMasterGain(audio));
  }
  return toneFilter;
}

function getNoiseFilter(audio: AudioContext, cutoff: number) {
  const key = Math.round(cutoff);
  let filter = noiseFilters.get(key);
  if (!filter) {
    filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = key;
    filter.connect(getMasterGain(audio));
    noiseFilters.set(key, filter);
  }
  return filter;
}

function getNoiseBuffer(audio: AudioContext) {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === audio.sampleRate) return cachedNoiseBuffer;
  const length = Math.max(1, Math.floor(audio.sampleRate));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
  cachedNoiseBuffer = buffer;
  return buffer;
}

type CachedCueName = "plinkoPeg" | "plinkoLaunch" | "plinkoBucket";

type CueTone = {
  start: number;
  end: number;
  gain: number;
  delay?: number;
  wave?: "sine" | "triangle" | "saw";
};

type CueSpec = { duration: number; tones: CueTone[] };

function waveform(kind: CueTone["wave"], phase: number) {
  const sine = Math.sin(phase);
  if (kind === "triangle") return (2 / Math.PI) * Math.asin(sine);
  if (kind === "saw") return 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + .5));
  return sine;
}

function cueSpec(name: CachedCueName, ratio: number): CueSpec {
  if (name === "plinkoPeg") {
    return {
      duration: .062,
      tones: [
        { start: 920 * ratio, end: 690 * ratio, gain: .016, wave: "triangle" },
        { start: 1380 * ratio, end: 1080 * ratio, gain: .009, delay: .006, wave: "sine" },
      ],
    };
  }
  if (name === "plinkoLaunch") {
    return {
      duration: .18,
      tones: [
        { start: 190 * ratio, end: 720 * ratio, gain: .021, wave: "saw" },
        { start: 760 * ratio, end: 1120 * ratio, gain: .019, delay: .035, wave: "sine" },
      ],
    };
  }
  return {
    duration: .15,
    tones: [
      { start: 360 * ratio, end: 520 * ratio, gain: .023, wave: "triangle" },
      { start: 720 * ratio, end: 980 * ratio, gain: .02, delay: .025, wave: "sine" },
    ],
  };
}

function makeCueBuffer(audio: AudioContext, spec: CueSpec) {
  const length = Math.max(1, Math.ceil(audio.sampleRate * spec.duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const t = index / audio.sampleRate;
    let sample = 0;
    for (const toneSpec of spec.tones) {
      const local = t - (toneSpec.delay ?? 0);
      if (local < 0) continue;
      const available = Math.max(.001, spec.duration - (toneSpec.delay ?? 0));
      const progress = Math.min(1, local / available);
      const frequency = toneSpec.start * (toneSpec.end / toneSpec.start) ** progress;
      const attack = Math.min(1, local / .008);
      const decay = (1 - progress) ** 2.25;
      sample += waveform(toneSpec.wave, 2 * Math.PI * frequency * local) * toneSpec.gain * attack * decay;
    }
    channel[index] = Math.max(-.92, Math.min(.92, sample));
  }
  return buffer;
}

function getCueBuffers(audio: AudioContext, name: CachedCueName) {
  const cached = cachedCueBuffers.get(name);
  if (cached?.[0]?.sampleRate === audio.sampleRate) return cached;
  const ratios = name === "plinkoPeg" ? [.94, .98, 1, 1.035, 1.07] : [.98, 1, 1.025];
  const buffers = ratios.map((ratio) => makeCueBuffer(audio, cueSpec(name, ratio)));
  cachedCueBuffers.set(name, buffers);
  return buffers;
}

function bufferedCue(name: CachedCueName) {
  const audio = getContext();
  if (!audio) return;
  const buffers = getCueBuffers(audio, name);
  const buffer = buffers[Math.floor(Math.random() * buffers.length)] ?? buffers[0];
  if (!buffer) return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(getMasterGain(audio));
  source.onended = () => source.disconnect();
  source.start();
}

function tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0, endFreq?: number) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(getToneFilter(audio));
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
  };
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration: number, gain: number, delay = 0, cutoff = 1800) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const source = audio.createBufferSource();
  const amp = audio.createGain();
  source.buffer = getNoiseBuffer(audio);
  amp.gain.setValueAtTime(Math.max(0.0001, gain), start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(amp).connect(getNoiseFilter(audio, cutoff));
  source.onended = () => {
    source.disconnect();
    amp.disconnect();
  };
  source.start(start);
  source.stop(start + duration + 0.02);
}

export type SoundName =
  | "spin" | "tick" | "anticipation" | "win" | "bigWin" | "lose" | "click" | "cash" | "bonus"
  | "tigerScatter" | "tigerThrow" | "tigerImpact" | "tigerBonus" | "tigerRetrigger" | "tigerMiss"
  | "olympusCluster" | "olympusFall" | "olympusCharge" | "olympusHit" | "olympusMultiplier"
  | "candyPop" | "candyBreak" | "candyBounce" | "candyBomb" | "candyExplosion" | "candyStreak"
  | "minesMetal" | "minesUnlock" | "minesCrystal" | "minesDanger" | "minesExplosion" | "minesCashout"
  | "plinkoPortal" | "plinkoLaunch" | "plinkoPeg" | "plinkoBucket" | "plinkoHigh";

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  if (name === "plinkoPeg") {
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    if (!repeatedAudioGate.allow("plinkoPeg", now)) return;
  }

  switch (name) {
    case "spin":
      noise(0.22, 0.02, 0, 1200); tone(150, 0.2, "sawtooth", 0.035, 0, 290); tone(330, 0.12, "triangle", 0.035, 0.055, 480); break;
    case "tick":
      tone(980, 0.045, "square", 0.018, 0, 720); tone(1450, 0.035, "sine", 0.012, 0.008, 1050); break;
    case "anticipation":
      tone(132, 0.34, "sine", 0.042, 0, 168); tone(264, 0.2, "triangle", 0.028, 0.08, 352); tone(420, 0.16, "sine", 0.025, 0.18, 620); noise(0.25, 0.008, 0.08, 900); break;
    case "tigerScatter":
      tone(880, 0.16, "sine", 0.038, 0, 1320); tone(440, 0.2, "triangle", 0.025, 0.035, 660); noise(0.11, 0.006, 0.02, 2600); break;
    case "tigerThrow":
      noise(0.22, 0.012, 0, 3200); tone(220, 0.28, "sawtooth", 0.028, 0, 760); tone(660, 0.2, "triangle", 0.03, 0.08, 1180); break;
    case "tigerImpact":
      noise(0.12, 0.022, 0, 2100); tone(170, 0.16, "triangle", 0.045, 0, 105); tone(1180, 0.09, "sine", 0.022, 0.01, 780); break;
    case "tigerBonus":
      noise(0.5, 0.015, 0, 3300); tone(118, 0.7, "sine", 0.055, 0, 82); [392,523,659,784,1046,1318].forEach((f,i)=>tone(f,0.32,i%2===0?"triangle":"sine",0.058,0.09+i*0.07,f*1.06)); break;
    case "tigerRetrigger":
      [784,1046,1318,1568].forEach((f,i)=>tone(f,0.22,"sine",0.05,i*0.06,f*1.05)); tone(262,0.38,"triangle",0.03,0.04,524); break;
    case "tigerMiss":
      tone(410,0.16,"triangle",0.022,0,330); tone(290,0.2,"sine",0.018,0.08,210); break;
    case "olympusCluster":
      [330,440,554].forEach((f,i)=>tone(f,0.13,"triangle",0.03,i*0.035,f*1.08)); noise(0.12,0.009,0,2400); break;
    case "olympusFall":
      noise(0.18,0.012,0,1100); tone(250,0.16,"sine",0.022,0,170); break;
    case "olympusCharge":
      tone(96,0.52,"sine",0.045,0,150); tone(220,0.42,"sawtooth",0.028,0.05,720); noise(0.38,0.008,0.08,1500); break;
    case "olympusHit":
      noise(0.22,0.028,0,3200); tone(78,0.36,"sine",0.06,0,52); tone(1180,0.11,"square",0.025,0.01,620); break;
    case "olympusMultiplier":
      [523,784,1046].forEach((f,i)=>tone(f,0.2,"sine",0.04,i*0.055,f*1.05)); break;
    case "candyPop": {
      const v = 0.97 + Math.random() * 0.06;
      tone(620*v,0.11,"triangle",0.028,0,980*v); break;
    }
    case "candyBreak": {
      const v = 0.97 + Math.random() * 0.06;
      tone(880*v,0.14,"triangle",0.03,0,410*v); tone(1240*v,0.09,"sine",0.018,0.025,700*v); break;
    }
    case "candyBounce":
      tone(320,0.12,"triangle",0.024,0,520); break;
    case "candyBomb":
      tone(210,0.34,"sine",0.036,0,680); tone(440,0.25,"triangle",0.025,0.08,1120); break;
    case "candyExplosion":
      noise(0.2,0.02,0,2800); tone(180,0.28,"sine",0.045,0,72); tone(1320,0.13,"triangle",0.025,0.01,420); break;
    case "candyStreak":
      [520,660,820].forEach((f,i)=>tone(f,0.14,"triangle",0.024,i*0.045,f*1.2)); break;
    case "minesMetal":
      noise(0.055,0.015,0,1500); tone(210,0.09,"triangle",0.024,0,155); break;
    case "minesUnlock":
      tone(460,0.12,"square",0.018,0,640); tone(720,0.1,"sine",0.02,0.055,940); break;
    case "minesCrystal": {
      const v = 0.96 + Math.random() * 0.08;
      tone(760*v,0.18,"sine",0.035,0,1280*v); tone(1140*v,0.16,"triangle",0.022,0.04,1540*v); break;
    }
    case "minesDanger":
      tone(92,0.3,"sine",0.036,0,76); tone(184,0.24,"sawtooth",0.014,0.04,132); break;
    case "minesExplosion":
      noise(0.28,0.035,0,1900); tone(88,0.38,"sine",0.06,0,42); tone(1180,0.1,"square",0.018,0.01,420); break;
    case "minesCashout":
      [523,659,880,1174].forEach((f,i)=>tone(f,0.2,"sine",0.04,i*0.045,f*1.05)); break;
    case "plinkoPortal":
      tone(118,0.32,"sine",0.034,0,240); tone(236,0.28,"triangle",0.026,0.04,710); noise(0.22,0.007,0.06,2300); break;
    case "plinkoLaunch":
      bufferedCue("plinkoLaunch"); break;
    case "plinkoPeg":
      bufferedCue("plinkoPeg"); break;
    case "plinkoBucket":
      bufferedCue("plinkoBucket"); break;
    case "plinkoHigh":
      noise(0.18,0.012,0,3200); [659,880,1174,1568].forEach((f,i)=>tone(f,0.21,"sine",0.04,i*0.05,f*1.08)); break;
    case "click":
      tone(560,0.055,"triangle",0.03,0,720); break;
    case "win":
      [523,659,784,1046].forEach((f,i)=>tone(f,0.2,i%2===0?"triangle":"sine",0.048,i*0.07,f*1.03)); break;
    case "bigWin":
      noise(0.3,0.012,0,3200); [392,523,659,784,1046,1318].forEach((f,i)=>tone(f,0.28,"triangle",0.055,i*0.075,f*1.08)); break;
    case "bonus":
      noise(0.42,0.014,0,3600); [392,523,659,784,1046,1318,1568].forEach((f,i)=>tone(f,0.32,i%2===0?"triangle":"sine",0.058,i*0.065,f*1.1)); tone(196,0.55,"sine",0.04,0.06,392); break;
    case "cash":
      [659,880,1174].forEach((f,i)=>tone(f,0.18,"sine",0.045,i*0.055,f*1.04)); break;
    case "lose":
      noise(0.16,0.018,0,650); tone(260,0.2,"sawtooth",0.035,0,155); tone(180,0.28,"sine",0.035,0.075,110); break;
  }
}
