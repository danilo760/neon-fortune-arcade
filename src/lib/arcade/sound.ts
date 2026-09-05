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
      duration: .052,
      tones: [
        { start: 860 * ratio, end: 690 * ratio, gain: .012, wave: "triangle" },
        { start: 1290 * ratio, end: 1030 * ratio, gain: .0065, delay: .005, wave: "sine" },
      ],
    };
  }
  if (name === "plinkoLaunch") {
    return {
      duration: .16,
      tones: [
        { start: 205 * ratio, end: 670 * ratio, gain: .018, wave: "saw" },
        { start: 700 * ratio, end: 1030 * ratio, gain: .016, delay: .03, wave: "sine" },
      ],
    };
  }
  return {
    duration: .13,
    tones: [
      { start: 330 * ratio, end: 500 * ratio, gain: .02, wave: "triangle" },
      { start: 690 * ratio, end: 930 * ratio, gain: .016, delay: .022, wave: "sine" },
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
  const ratios = name === "plinkoPeg" ? [.95, .98, 1, 1.03, 1.06] : [.98, 1, 1.025];
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
  | "tigerFeatureOpen" | "tigerCardAppear" | "tigerFeatureStart"
  | "olympusCluster" | "olympusFall" | "olympusCharge" | "olympusHit" | "olympusMultiplier"
  | "olympusSpin" | "olympusBonusSpin" | "olympusScatter" | "olympusAnticipation"
  | "olympusFeatureOpen" | "olympusBonusIntro" | "olympusRetrigger" | "olympusBonusEnd" | "olympusBigWin"
  | "candyPop" | "candyBreak" | "candyBounce" | "candyBomb" | "candyExplosion" | "candyStreak"
  | "minesMetal" | "minesUnlock" | "minesCrystal" | "minesDanger" | "minesExplosion" | "minesCashout"
  | "plinkoPortal" | "plinkoLaunch" | "plinkoPeg" | "plinkoBucket" | "plinkoHigh";

export function playOlympusLevelUp(level: number, enabled: boolean) {
  if (!enabled) return;
  const clamped = Math.max(2, Math.min(5, Math.round(level)));
  const ratio = 1 + (clamped - 2) * .09;
  tone(220 * ratio, .17, "triangle", .026, 0, 360 * ratio);
  tone(440 * ratio, .19, "sine", .023, .04, 660 * ratio);
  noise(.1, .0045, 0, 1400);
}

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
      tone(132, 0.34, "sine", 0.038, 0, 168); tone(264, 0.2, "triangle", 0.024, 0.08, 352); tone(420, 0.16, "sine", 0.021, 0.18, 620); noise(0.22, 0.006, 0.08, 900); break;
    case "tigerScatter":
      tone(840, 0.14, "sine", 0.034, 0, 1260); tone(420, 0.18, "triangle", 0.022, 0.03, 650); noise(0.08, 0.0045, 0.02, 2500); break;
    case "tigerFeatureOpen":
      tone(392,0.14,"triangle",0.024,0,523); tone(659,0.18,"sine",0.028,0.05,880); tone(1046,0.16,"sine",0.019,0.1,1318); break;
    case "tigerCardAppear":
      tone(760,0.105,"triangle",0.026,0,1140); tone(1450,0.085,"sine",0.015,0.022,1060); noise(0.055,0.003,0.008,3000); break;
    case "tigerFeatureStart":
      noise(0.24,0.009,0,3000); tone(104,0.48,"sine",0.045,0,76); [523,659,880,1174].forEach((f,i)=>tone(f,0.24,i%2===0?"triangle":"sine",0.042,0.055+i*0.06,f*1.05)); break;
    case "tigerThrow":
      noise(0.14, 0.008, 0, 3000); tone(240, 0.23, "sawtooth", 0.023, 0, 700); tone(690, 0.16, "triangle", 0.025, 0.065, 1120); break;
    case "tigerImpact":
      noise(0.095, 0.016, 0, 1900); tone(155, 0.15, "triangle", 0.038, 0, 96); tone(1240, 0.075, "sine", 0.018, 0.012, 820); break;
    case "tigerBonus":
      noise(0.32, 0.011, 0, 3000); tone(124, 0.5, "sine", 0.046, 0, 86); [392,523,659,880,1174].forEach((f,i)=>tone(f,0.26,i%2===0?"triangle":"sine",0.046,0.075+i*0.065,f*1.05)); break;
    case "tigerRetrigger":
      [740,988,1318].forEach((f,i)=>tone(f,0.19,"sine",0.041,i*0.055,f*1.06)); tone(294,0.28,"triangle",0.024,0.035,560); break;
    case "tigerMiss":
      tone(390,0.14,"triangle",0.018,0,318); tone(265,0.18,"sine",0.014,0.07,205); break;
    case "olympusSpin":
      noise(.22,.007,0,950); tone(82,.25,"sine",.022,0,108); tone(164,.18,"triangle",.011,.04,210); break;
    case "olympusBonusSpin":
      noise(.24,.008,0,1150); tone(86,.26,"sine",.025,0,118); tone(172,.2,"triangle",.013,.035,245); break;
    case "olympusScatter":
      tone(410,.14,"triangle",.025,0,690); tone(820,.15,"sine",.016,.035,1180); noise(.075,.0035,.01,2500); break;
    case "olympusAnticipation":
      tone(72,.36,"sine",.031,0,88); tone(144,.28,"triangle",.012,.06,226); noise(.22,.0048,.05,720); break;
    case "olympusFeatureOpen":
      noise(.22,.008,0,1600); tone(62,.5,"sine",.043,0,96); tone(310,.34,"triangle",.019,.08,700); break;
    case "olympusBonusIntro":
      noise(.24,.009,0,2000); tone(72,.43,"sine",.044,0,48); [294,392,523,698].forEach((f,i)=>tone(f,.22,i%2===0?"triangle":"sine",.029,.075+i*.055,f*1.07)); break;
    case "olympusRetrigger":
      tone(92,.29,"sine",.03,0,126); [440,660,880].forEach((f,i)=>tone(f,.18,"sine",.03,.045+i*.055,f*1.07)); break;
    case "olympusBonusEnd":
      [262,392,523].forEach((f,i)=>tone(f,.18,"triangle",.025,i*.05,f*1.04)); tone(82,.24,"sine",.018,0,62); break;
    case "olympusBigWin":
      noise(.19,.012,0,2200); tone(64,.42,"sine",.048,0,42); [330,494,659,988].forEach((f,i)=>tone(f,.22,i%2===0?"triangle":"sine",.033,.05+i*.06,f*1.055)); break;
    case "olympusCluster":
      tone(430,.085,"triangle",.022,0,620); tone(700,.065,"sine",.013,.02,850); noise(.045,.004,0,2100); break;
    case "olympusFall":
      noise(0.14,0.008,0,1050); tone(250,0.13,"sine",0.018,0,172); break;
    case "olympusCharge":
      tone(96,.4,"sine",.035,0,150); tone(220,.32,"sawtooth",.02,.045,650); noise(.22,.005,.07,1350); break;
    case "olympusHit":
      noise(.115,.022,0,3200); tone(1200,.075,"square",.019,0,590); tone(76,.28,"sine",.05,.012,48); noise(.14,.006,.065,780); break;
    case "olympusMultiplier":
      tone(659,.12,"triangle",.03,0,880); tone(1046,.14,"sine",.028,.04,1318); break;
    case "candyPop": {
      const v = 0.975 + Math.random() * 0.05;
      tone(600*v,0.09,"triangle",0.023,0,920*v); break;
    }
    case "candyBreak": {
      const v = 0.975 + Math.random() * 0.05;
      tone(820*v,0.105,"triangle",0.024,0,430*v); tone(1180*v,0.075,"sine",0.013,0.02,720*v); break;
    }
    case "candyBounce":
      tone(300,0.095,"triangle",0.019,0,500); break;
    case "candyBomb":
      tone(190,0.28,"sine",0.03,0,610); tone(410,0.2,"triangle",0.02,0.07,980); break;
    case "candyExplosion":
      noise(0.15,0.014,0,2500); tone(170,0.22,"sine",0.036,0,78); tone(1220,0.09,"triangle",0.018,0.012,460); break;
    case "candyStreak":
      [520,680,860].forEach((f,i)=>tone(f,0.115,"triangle",0.019,i*0.04,f*1.16)); break;
    case "minesMetal":
      noise(0.045,0.011,0,1450); tone(205,0.075,"triangle",0.019,0,158); break;
    case "minesUnlock":
      tone(450,0.105,"square",0.014,0,630); tone(710,0.085,"sine",0.017,0.048,920); break;
    case "minesCrystal": {
      const v = 0.97 + Math.random() * 0.06;
      tone(760*v,0.15,"sine",0.03,0,1250*v); tone(1120*v,0.13,"triangle",0.018,0.035,1500*v); break;
    }
    case "minesDanger":
      tone(94,0.26,"sine",0.03,0,78); tone(188,0.2,"sawtooth",0.011,0.04,136); break;
    case "minesExplosion":
      noise(0.21,0.025,0,1700); tone(88,0.3,"sine",0.052,0,44); tone(1120,0.075,"square",0.013,0.012,440); break;
    case "minesCashout":
      [523,698,932].forEach((f,i)=>tone(f,0.17,"sine",0.034,i*0.05,f*1.05)); break;
    case "plinkoPortal":
      tone(118,0.27,"sine",0.028,0,230); tone(236,0.23,"triangle",0.021,0.038,660); noise(0.16,0.0048,0.055,2100); break;
    case "plinkoLaunch":
      bufferedCue("plinkoLaunch"); break;
    case "plinkoPeg":
      bufferedCue("plinkoPeg"); break;
    case "plinkoBucket":
      bufferedCue("plinkoBucket"); break;
    case "plinkoHigh":
      noise(0.12,0.0075,0,2900); [659,880,1174].forEach((f,i)=>tone(f,0.18,"sine",0.033,i*0.05,f*1.07)); break;
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
