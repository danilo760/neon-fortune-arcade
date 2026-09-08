import { AudioEventGate } from "./audioEventGate";

/**
 * Procedural WebAudio engine for the arcade.
 *
 * Design goals:
 * - one AudioContext only;
 * - semantic buses so UI, gameplay, impacts and rewards do not fight for headroom;
 * - a gentle master compressor to keep layered cues controlled on phone speakers;
 * - short ducking on large impacts/rewards;
 * - optional stereo position for spatial events such as Plinko pegs;
 * - no autoplay and no third-party/commercial audio assets.
 */

type AudioBus = "ui" | "game" | "impact" | "reward" | "ambience";
export type AmbienceTheme = "tiger" | "olympus" | "candy" | "mines" | "plinko";
export type SoundOptions = {
  /** -1 = left, 0 = centre, 1 = right. Kept intentionally subtle in use. */
  pan?: number;
  /** Scales one cue without changing the global mixer. */
  intensity?: number;
  /** Small timbral variation for sequential cues; clamped to avoid cartoonish shifts. */
  pitch?: number;
};

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let reverbConvolver: ConvolverNode | null = null;
let reverbFilter: BiquadFilterNode | null = null;
let reverbGain: GainNode | null = null;
const busGains = new Map<AudioBus, GainNode>();
const toneFilters = new Map<AudioBus, BiquadFilterNode>();
let cachedNoiseBuffer: AudioBuffer | null = null;
const cachedCueBuffers = new Map<string, AudioBuffer[]>();
const noiseFilters = new Map<string, BiquadFilterNode>();
const repeatedAudioGate = new AudioEventGate();

let activeBus: AudioBus = "game";
let activePan = 0;
let activeIntensity = 1;
let activePitch = 1;

const BUS_LEVEL: Record<AudioBus, number> = {
  ui: 0.7,
  game: 0.88,
  impact: 0.92,
  reward: 0.86,
  ambience: 0.34,
};

type AmbienceVoice = {
  theme: AmbienceTheme;
  root: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

let desiredAmbienceTheme: AmbienceTheme | null = null;
let desiredAmbienceEnabled = false;
let ambienceEnergy = 1;
let ambienceVoice: AmbienceVoice | null = null;

const AMBIENCE_GAIN: Record<AmbienceTheme, number> = {
  tiger: 0.052,
  olympus: 0.058,
  candy: 0.044,
  mines: 0.046,
  plinko: 0.038,
};

function resetGraphCaches() {
  stopAmbience();
  masterGain = null;
  masterCompressor = null;
  reverbConvolver = null;
  reverbFilter = null;
  reverbGain = null;
  busGains.clear();
  toneFilters.clear();
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
    masterGain.gain.value = 0.92;

    masterCompressor = audio.createDynamicsCompressor();
    masterCompressor.threshold.value = -10;
    masterCompressor.knee.value = 18;
    masterCompressor.ratio.value = 3;
    masterCompressor.attack.value = 0.004;
    masterCompressor.release.value = 0.16;

    masterGain.connect(masterCompressor).connect(audio.destination);
  }
  return masterGain;
}

function getReverbInput(audio: AudioContext) {
  if (!reverbConvolver || !reverbFilter || !reverbGain) {
    reverbConvolver = audio.createConvolver();
    const duration = 0.48;
    const length = Math.max(1, Math.floor(audio.sampleRate * duration));
    const impulse = audio.createBuffer(2, length, audio.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const progress = index / length;
        const earlyReflection =
          index < audio.sampleRate * 0.055
            ? Math.sin(index * (channel === 0 ? 0.071 : 0.076)) * 0.14
            : 0;
        const decay = (1 - progress) ** 3.2;
        data[index] = (Math.random() * 2 - 1) * decay * 0.34 + earlyReflection * decay;
      }
    }
    reverbConvolver.buffer = impulse;

    reverbFilter = audio.createBiquadFilter();
    reverbFilter.type = "lowpass";
    reverbFilter.frequency.value = 4300;
    reverbFilter.Q.value = 0.3;

    reverbGain = audio.createGain();
    reverbGain.gain.value = 0.12;

    reverbConvolver.connect(reverbFilter).connect(reverbGain).connect(getMasterGain(audio));
  }
  return reverbConvolver;
}

function addAccentReverb(audio: AudioContext, source: AudioNode, bus: AudioBus) {
  if (bus !== "reward" && bus !== "impact") return;
  source.connect(getReverbInput(audio));
}

function getBusGain(audio: AudioContext, bus: AudioBus) {
  let node = busGains.get(bus);
  if (!node) {
    node = audio.createGain();
    node.gain.value = BUS_LEVEL[bus];
    node.connect(getMasterGain(audio));
    busGains.set(bus, node);
  }
  return node;
}

/**
 * Shares the existing arcade AudioContext and ambience bus with adaptive music.
 * Keeping the score inside this graph means cues, ambience and music all pass
 * through the same master compressor instead of opening competing contexts.
 */
export function getArcadeMusicGraph(): { context: AudioContext; destination: AudioNode } | null {
  const audio = getContext();
  if (!audio) return null;
  ensureAmbience(audio);
  return { context: audio, destination: getBusGain(audio, "ambience") };
}

function getToneFilter(audio: AudioContext, bus = activeBus) {
  let node = toneFilters.get(bus);
  if (!node) {
    node = audio.createBiquadFilter();
    node.type = "lowpass";
    node.frequency.value = bus === "impact" ? 5200 : bus === "ui" ? 4600 : 5000;
    node.Q.value = 0.35;
    node.connect(getBusGain(audio, bus));
    toneFilters.set(bus, node);
  }
  return node;
}

function getNoiseFilter(audio: AudioContext, cutoff: number, bus = activeBus) {
  const key = `${bus}:${Math.round(cutoff)}`;
  let filter = noiseFilters.get(key);
  if (!filter) {
    filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.round(cutoff);
    filter.Q.value = 0.25;
    filter.connect(getBusGain(audio, bus));
    noiseFilters.set(key, filter);
  }
  return filter;
}

function connectWithPan(
  audio: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  pan: number,
): StereoPannerNode | null {
  const clamped = Math.max(-0.78, Math.min(0.78, pan));
  if (Math.abs(clamped) < 0.01 || typeof audio.createStereoPanner !== "function") {
    source.connect(destination);
    return null;
  }
  const panner = audio.createStereoPanner();
  panner.pan.value = clamped;
  source.connect(panner).connect(destination);
  return panner;
}

function duckForAccent(audio: AudioContext, bus: AudioBus) {
  if (bus !== "impact" && bus !== "reward") return;
  const game = getBusGain(audio, "game");
  const now = audio.currentTime;
  const floor = bus === "impact" ? 0.58 : 0.7;
  game.gain.cancelScheduledValues(now);
  game.gain.setValueAtTime(Math.max(0.0001, game.gain.value), now);
  game.gain.linearRampToValueAtTime(BUS_LEVEL.game * floor, now + 0.018);
  game.gain.exponentialRampToValueAtTime(BUS_LEVEL.game, now + (bus === "impact" ? 0.22 : 0.17));

  const ambience = getBusGain(audio, "ambience");
  const ambienceFloor = bus === "impact" ? 0.38 : 0.56;
  ambience.gain.cancelScheduledValues(now);
  ambience.gain.setValueAtTime(Math.max(0.0001, ambience.gain.value), now);
  ambience.gain.linearRampToValueAtTime(BUS_LEVEL.ambience * ambienceFloor, now + 0.022);
  ambience.gain.exponentialRampToValueAtTime(BUS_LEVEL.ambience, now + (bus === "impact" ? 0.34 : 0.26));
}

function stopAmbience() {
  const voice = ambienceVoice;
  ambienceVoice = null;
  if (!voice) return;
  for (const source of voice.sources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  for (const node of voice.nodes) {
    try { node.disconnect(); } catch {}
  }
  try { voice.root.disconnect(); } catch {}
}

function themeVoiceSpec(theme: AmbienceTheme) {
  switch (theme) {
    case "tiger":
      return { tones: [98, 147, 196], wave: "sine" as OscillatorType, noiseCutoff: 1050, noiseGain: 0.16, lfoHz: 0.115 };
    case "olympus":
      return { tones: [55, 82.5, 165], wave: "sine" as OscillatorType, noiseCutoff: 780, noiseGain: 0.24, lfoHz: 0.075 };
    case "candy":
      return { tones: [261.63, 392, 523.25], wave: "triangle" as OscillatorType, noiseCutoff: 2350, noiseGain: 0.075, lfoHz: 0.16 };
    case "mines":
      return { tones: [43.65, 65.41, 130.81], wave: "sine" as OscillatorType, noiseCutoff: 520, noiseGain: 0.2, lfoHz: 0.055 };
    case "plinko":
      return { tones: [110, 220, 329.63], wave: "sine" as OscillatorType, noiseCutoff: 1600, noiseGain: 0.08, lfoHz: 0.13 };
  }
}

function ensureAmbience(audio: AudioContext) {
  if (!desiredAmbienceEnabled || !desiredAmbienceTheme) {
    stopAmbience();
    return;
  }
  if (ambienceVoice?.theme === desiredAmbienceTheme) {
    const now = audio.currentTime;
    const target = AMBIENCE_GAIN[desiredAmbienceTheme] * ambienceEnergy;
    ambienceVoice.root.gain.cancelScheduledValues(now);
    ambienceVoice.root.gain.setTargetAtTime(target, now, 0.18);
    return;
  }

  stopAmbience();
  const theme = desiredAmbienceTheme;
  const spec = themeVoiceSpec(theme);
  const root = audio.createGain();
  const now = audio.currentTime;
  root.gain.setValueAtTime(0.0001, now);
  root.gain.exponentialRampToValueAtTime(Math.max(0.0001, AMBIENCE_GAIN[theme] * ambienceEnergy), now + 0.7);
  root.connect(getBusGain(audio, "ambience"));

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [root];

  spec.tones.forEach((frequency, index) => {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    const filter = audio.createBiquadFilter();
    osc.type = index === 2 && theme === "candy" ? "triangle" : spec.wave;
    osc.frequency.value = frequency;
    amp.gain.value = index === 0 ? 0.34 : index === 1 ? 0.18 : 0.085;
    filter.type = "lowpass";
    filter.frequency.value = theme === "candy" ? 1800 : theme === "plinko" ? 1450 : 920;
    filter.Q.value = 0.2;
    osc.connect(amp).connect(filter).connect(root);
    osc.start();
    sources.push(osc);
    nodes.push(amp, filter);
  });

  const noiseSource = audio.createBufferSource();
  const noiseAmp = audio.createGain();
  const noiseFilter = audio.createBiquadFilter();
  noiseSource.buffer = getNoiseBuffer(audio);
  noiseSource.loop = true;
  noiseAmp.gain.value = spec.noiseGain;
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = spec.noiseCutoff;
  noiseFilter.Q.value = 0.22;
  noiseSource.connect(noiseAmp).connect(noiseFilter).connect(root);
  noiseSource.start();
  sources.push(noiseSource);
  nodes.push(noiseAmp, noiseFilter);

  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  lfo.type = "sine";
  lfo.frequency.value = spec.lfoHz;
  lfoGain.gain.value = AMBIENCE_GAIN[theme] * 0.16;
  lfo.connect(lfoGain).connect(root.gain);
  lfo.start();
  sources.push(lfo);
  nodes.push(lfoGain);

  ambienceVoice = { theme, root, sources, nodes };
}

export function setGameAmbience(theme: AmbienceTheme, enabled: boolean) {
  if (!enabled) {
    if (desiredAmbienceTheme === theme) {
      desiredAmbienceEnabled = false;
      desiredAmbienceTheme = null;
      stopAmbience();
    }
    return;
  }
  desiredAmbienceTheme = theme;
  desiredAmbienceEnabled = true;
  if (ctx?.state === "running") ensureAmbience(ctx);
}

export function setAmbienceEnergy(value: number) {
  ambienceEnergy = Math.max(0.58, Math.min(1.45, value));
  if (ctx?.state === "running") ensureAmbience(ctx);
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
  if (kind === "saw") return 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
  return sine;
}

function cueSpec(name: CachedCueName, ratio: number): CueSpec {
  if (name === "plinkoPeg") {
    return {
      duration: 0.058,
      tones: [
        { start: 910 * ratio, end: 680 * ratio, gain: 0.011, wave: "triangle" },
        { start: 1470 * ratio, end: 1010 * ratio, gain: 0.0055, delay: 0.004, wave: "sine" },
      ],
    };
  }
  if (name === "plinkoLaunch") {
    return {
      duration: 0.17,
      tones: [
        { start: 190 * ratio, end: 720 * ratio, gain: 0.017, wave: "saw" },
        { start: 690 * ratio, end: 1180 * ratio, gain: 0.014, delay: 0.032, wave: "sine" },
      ],
    };
  }
  return {
    duration: 0.145,
    tones: [
      { start: 300 * ratio, end: 540 * ratio, gain: 0.019, wave: "triangle" },
      { start: 670 * ratio, end: 980 * ratio, gain: 0.015, delay: 0.02, wave: "sine" },
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
      const available = Math.max(0.001, spec.duration - (toneSpec.delay ?? 0));
      const progress = Math.min(1, local / available);
      const frequency = toneSpec.start * (toneSpec.end / toneSpec.start) ** progress;
      const attack = Math.min(1, local / 0.006);
      const decay = (1 - progress) ** 2.35;
      sample += waveform(toneSpec.wave, 2 * Math.PI * frequency * local) * toneSpec.gain * attack * decay;
    }
    channel[index] = Math.max(-0.92, Math.min(0.92, sample));
  }
  return buffer;
}

function getCueBuffers(audio: AudioContext, name: CachedCueName) {
  const cached = cachedCueBuffers.get(name);
  if (cached?.[0]?.sampleRate === audio.sampleRate) return cached;
  const ratios = name === "plinkoPeg" ? [0.94, 0.97, 1, 1.03, 1.06] : [0.98, 1, 1.025];
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
  const amp = audio.createGain();
  amp.gain.value = activeIntensity;
  source.buffer = buffer;
  source.playbackRate.value = activePitch;
  const panner = connectWithPan(audio, amp, getBusGain(audio, activeBus), activePan);
  source.connect(amp);
  addAccentReverb(audio, amp, activeBus);
  source.onended = () => {
    source.disconnect();
    amp.disconnect();
    panner?.disconnect();
  };
  source.start();
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
  const filter = getToneFilter(audio, activeBus);
  osc.type = type;
  osc.frequency.setValueAtTime(freq * activePitch, start);
  if (endFreq && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq * activePitch, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * activeIntensity), start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const panner = connectWithPan(audio, amp, filter, activePan);
  osc.connect(amp);
  addAccentReverb(audio, amp, activeBus);
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
    panner?.disconnect();
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
  const filter = getNoiseFilter(audio, cutoff, activeBus);
  source.buffer = getNoiseBuffer(audio);
  amp.gain.setValueAtTime(Math.max(0.0001, gain * activeIntensity), start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const panner = connectWithPan(audio, amp, filter, activePan);
  source.connect(amp);
  addAccentReverb(audio, amp, activeBus);
  source.onended = () => {
    source.disconnect();
    amp.disconnect();
    panner?.disconnect();
  };
  source.start(start);
  source.stop(start + duration + 0.02);
}

export type SoundName =
  | "spin" | "tick" | "anticipation" | "win" | "bigWin" | "lose" | "click" | "cash" | "bonus"
  | "tigerScatter" | "tigerThrow" | "tigerImpact" | "tigerBonus" | "tigerRetrigger" | "tigerMiss"
  | "tigerFeatureOpen" | "tigerCardAppear" | "tigerFeatureStart"
  | "tigerLuckyFeature" | "tigerRespinRoll" | "tigerReelLand" | "tigerReveal" | "tigerWinAccent" | "tigerSymbolLock" | "tigerFullGrid"
  | "olympusCluster" | "olympusFall" | "olympusCharge" | "olympusHit" | "olympusMultiplier"
  | "olympusSpin" | "olympusBonusSpin" | "olympusScatter" | "olympusAnticipation"
  | "olympusFeatureOpen" | "olympusBonusIntro" | "olympusRetrigger" | "olympusBonusEnd" | "olympusBigWin"
  | "candyPop" | "candyBreak" | "candyBounce" | "candyBomb" | "candyExplosion" | "candyStreak"
  | "minesMetal" | "minesUnlock" | "minesCrystal" | "minesDanger" | "minesExplosion" | "minesCashout"
  | "plinkoPortal" | "plinkoLaunch" | "plinkoPeg" | "plinkoBucket" | "plinkoHigh";

export function playOlympusLevelUp(level: number, enabled: boolean) {
  if (!enabled) return;
  const previousBus = activeBus;
  const previousPan = activePan;
  const previousIntensity = activeIntensity;
  const previousPitch = activePitch;
  activeBus = "reward";
  activePan = 0;
  activeIntensity = 1;
  activePitch = 1;

  try {
    const audio = getContext();
    if (audio) {
      ensureAmbience(audio);
      duckForAccent(audio, activeBus);
    }
    const clamped = Math.max(2, Math.min(5, Math.round(level)));
    const ratio = 1 + (clamped - 2) * .09;
    tone(220 * ratio, .17, "triangle", .026, 0, 360 * ratio);
    tone(440 * ratio, .19, "sine", .023, .04, 660 * ratio);
    noise(.1, .0045, 0, 1400);
  } finally {
    activeBus = previousBus;
    activePan = previousPan;
    activeIntensity = previousIntensity;
    activePitch = previousPitch;
  }
}

function busForSound(name: SoundName): AudioBus {
  if (name === "click") return "ui";

  if (
    name === "olympusHit" ||
    name === "olympusBigWin" ||
    name === "candyExplosion" ||
    name === "minesExplosion" ||
    name === "tigerImpact" ||
    name === "tigerFullGrid" ||
    name === "bigWin" ||
    name === "bonus" ||
    name === "plinkoHigh"
  ) {
    return "impact";
  }

  if (
    name === "win" ||
    name === "cash" ||
    name === "tigerBonus" ||
    name === "tigerRetrigger" ||
    name === "tigerFeatureStart" ||
    name === "tigerWinAccent" ||
    name === "olympusMultiplier" ||
    name === "olympusBonusIntro" ||
    name === "olympusRetrigger" ||
    name === "olympusBonusEnd" ||
    name === "candyStreak" ||
    name === "minesCrystal" ||
    name === "minesCashout"
  ) {
    return "reward";
  }

  return "game";
}

export function playSound(name: SoundName, enabled: boolean, options: SoundOptions = {}) {
  if (!enabled) return;
  if (name === "plinkoPeg") {
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    if (!repeatedAudioGate.allow("plinkoPeg", now)) return;
  }

  const previousBus = activeBus;
  const previousPan = activePan;
  const previousIntensity = activeIntensity;
  const previousPitch = activePitch;
  activeBus = busForSound(name);
  activePan = Math.max(-0.78, Math.min(0.78, options.pan ?? 0));
  activeIntensity = Math.max(0.35, Math.min(1.2, options.intensity ?? 1));
  activePitch = Math.max(0.88, Math.min(1.22, options.pitch ?? 1));

  const audio = getContext();
  if (audio) {
    ensureAmbience(audio);
    duckForAccent(audio, activeBus);
  }

  try {
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
    case "tigerLuckyFeature":
      noise(0.26,0.009,0,2600); tone(112,0.44,"sine",0.042,0,168); [330,494,659,880].forEach((f,i)=>tone(f,0.22,i%2===0?"triangle":"sine",0.034,0.05+i*0.055,f*1.06)); break;
    case "tigerRespinRoll":
      noise(0.14,0.0065,0,1500); tone(196,0.17,"triangle",0.022,0,286); tone(392,0.12,"sine",0.013,0.04,470); break;
    case "tigerReelLand":
      noise(0.055,0.0075,0,1450); tone(118,0.09,"sine",0.025,0,82); tone(620,0.055,"triangle",0.014,0.012,470); break;
    case "tigerReveal":
      tone(523,0.13,"triangle",0.021,0,784); tone(784,0.16,"sine",0.018,0.045,1046); noise(0.07,0.0035,0.02,2800); break;
    case "tigerWinAccent":
      tone(330,0.18,"triangle",0.025,0,494); tone(494,0.2,"sine",0.024,0.05,659); tone(659,0.22,"sine",0.021,0.11,988); noise(0.09,0.004,0.035,3000); break;
    case "tigerSymbolLock":
      tone(880,0.085,"triangle",0.026,0,1240); tone(1320,0.07,"sine",0.014,0.022,1520); noise(0.05,0.0035,0.006,3200); break;
    case "tigerFullGrid":
      noise(0.34,0.014,0,3400); tone(96,0.56,"sine",0.05,0,64); [392,523,659,880,1174,1568].forEach((f,i)=>tone(f,0.3,i%2===0?"triangle":"sine",0.05,0.05+i*0.062,f*1.09)); break;
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
  } finally {
    activeBus = previousBus;
    activePan = previousPan;
    activeIntensity = previousIntensity;
    activePitch = previousPitch;
  }
}
