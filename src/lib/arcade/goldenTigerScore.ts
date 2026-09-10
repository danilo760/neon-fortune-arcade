import { getArcadeMusicGraph } from "./sound";

export type GoldenTigerAuthoredCue =
  | "spin"
  | "reel-loop"
  | "reel-stop"
  | "anticipation"
  | "symbol-land"
  | "feature-trigger"
  | "sticky-land"
  | "small-win"
  | "win"
  | "big-win"
  | "full-grid"
  | "button"
  | "toggle";

type CueOptions = {
  intensity?: number;
  pan?: number;
  column?: number;
};

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOP_SECONDS = BAR * 4;
const ROOT = 293.6648; // D4
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16] as const;
const MOTIF = [0, 2, 4, 2, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0, 2] as const;
const BASS = [0, 0, 7, 7, 9, 9, 7, 7] as const;

let boundContext: AudioContext | null = null;
let musicTimer = 0;
let nextMusicAt = 0;
let musicRunning = false;
const liveSources = new Set<AudioScheduledSourceNode>();
let noiseBuffer: AudioBuffer | null = null;

function graph() {
  const shared = getArcadeMusicGraph();
  if (!shared) return null;
  if (boundContext !== shared.context) {
    boundContext = shared.context;
    noiseBuffer = null;
    nextMusicAt = 0;
  }
  return shared;
}

function hz(semitones: number, octaveOffset = 0) {
  return ROOT * 2 ** ((semitones + octaveOffset * 12) / 12);
}

function remember<T extends AudioScheduledSourceNode>(node: T) {
  liveSources.add(node);
  node.addEventListener("ended", () => liveSources.delete(node), { once: true });
  return node;
}

function gainEnvelope(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  attack: number,
  releaseAt: number,
  end: number,
  peak: number,
) {
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  amp.gain.setValueAtTime(Math.max(0.0002, peak * .72), releaseAt);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  amp.connect(destination);
  return amp;
}

function pannedDestination(context: AudioContext, destination: AudioNode, pan = 0) {
  if (typeof context.createStereoPanner !== "function" || Math.abs(pan) < .01) return destination;
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-.72, Math.min(.72, pan));
  panner.connect(destination);
  return panner;
}

function pluck(
  frequency: number,
  start: number,
  duration: number,
  peak: number,
  pan = 0,
  bright = false,
) {
  const shared = graph();
  if (!shared) return;
  const { context, destination } = shared;
  const output = pannedDestination(context, destination, pan);
  const amp = gainEnvelope(context, output, start, .012, start + duration * .26, start + duration, peak);

  const body = remember(context.createOscillator());
  body.type = bright ? "triangle" : "sine";
  body.frequency.setValueAtTime(frequency, start);
  body.detune.setValueAtTime(bright ? 4 : -3, start);
  body.connect(amp);
  body.start(start);
  body.stop(start + duration + .01);

  const overtone = remember(context.createOscillator());
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(frequency * 2.01, start);
  const overtoneAmp = context.createGain();
  overtoneAmp.gain.setValueAtTime(Math.max(.0001, peak * .24), start);
  overtoneAmp.gain.exponentialRampToValueAtTime(.0001, start + duration * .52);
  overtone.connect(overtoneAmp).connect(output);
  overtone.start(start);
  overtone.stop(start + duration * .56);
}

function softBass(frequency: number, start: number, duration: number, peak: number) {
  const shared = graph();
  if (!shared) return;
  const { context, destination } = shared;
  const amp = gainEnvelope(context, destination, start, .025, start + duration * .55, start + duration, peak);
  const oscillator = remember(context.createOscillator());
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.connect(amp);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function pad(frequencies: readonly number[], start: number, duration: number, peak: number) {
  const shared = graph();
  if (!shared) return;
  const { context, destination } = shared;
  const amp = gainEnvelope(context, destination, start, .32, start + duration * .72, start + duration, peak);
  for (const [index, frequency] of frequencies.entries()) {
    const oscillator = remember(context.createOscillator());
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.value = index === 1 ? 5 : index === 2 ? -5 : 0;
    oscillator.connect(amp);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  }
}

function getNoiseBuffer(context: AudioContext) {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;
  const length = Math.max(1, Math.floor(context.sampleRate * .55));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic LCG: repeatable authored texture, not Math.random noise.
  let state = 0x73a91f2d;
  for (let index = 0; index < data.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[index] = ((state / 0xffffffff) * 2 - 1) * .88;
  }
  noiseBuffer = buffer;
  return buffer;
}

function noiseHit(start: number, duration: number, peak: number, low = 700, high = 4400, pan = 0) {
  const shared = graph();
  if (!shared) return;
  const { context, destination } = shared;
  const source = remember(context.createBufferSource());
  source.buffer = getNoiseBuffer(context);
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(Math.max(120, (low + high) / 2), start);
  band.Q.value = Math.max(.3, (low + high) / Math.max(100, high - low));
  const output = pannedDestination(context, destination, pan);
  const amp = gainEnvelope(context, output, start, .004, start + duration * .18, start + duration, peak);
  source.connect(band).connect(amp);
  source.start(start, 0, Math.min(duration, .54));
  source.stop(start + duration + .01);
}

function chimeStack(root: number, start: number, peak: number, spacing = .045) {
  [0, 4, 7, 12].forEach((step, index) => {
    pluck(root * 2 ** (step / 12), start + index * spacing, .52 + index * .07, peak * (1 - index * .09), (index - 1.5) * .16, true);
  });
}

function scheduleMusicSection(start: number) {
  const shared = graph();
  if (!shared) return;
  const motifStep = BEAT / 2;

  for (let index = 0; index < MOTIF.length * 2; index += 1) {
    const degree = MOTIF[index % MOTIF.length] ?? 0;
    const semitone = PENTATONIC.find((value) => value === degree) ?? degree;
    const phraseLift = index >= MOTIF.length ? 12 : 0;
    const at = start + index * motifStep;
    pluck(hz(semitone + phraseLift), at, .29, index % 4 === 0 ? .028 : .021, index % 2 ? .11 : -.11, index % 8 === 6);
  }

  for (let index = 0; index < BASS.length; index += 1) {
    softBass(hz(BASS[index] ?? 0, -2), start + index * BEAT, .62, .025);
  }

  for (let bar = 0; bar < 4; bar += 1) {
    const at = start + bar * BAR;
    const shift = bar === 2 ? 9 : bar === 3 ? 7 : 0;
    pad([hz(shift, -1), hz(shift + 4, -1), hz(shift + 7, -1)], at, BAR * .98, .012);
    noiseHit(at, .055, .014, 1200, 5200);
    noiseHit(at + BEAT * 2, .04, .009, 1800, 6500);
  }
}

function armNextSection() {
  if (!musicRunning) return;
  const shared = graph();
  if (!shared) return;
  const now = shared.context.currentTime;
  if (nextMusicAt < now + .08) nextMusicAt = now + .08;
  scheduleMusicSection(nextMusicAt);
  nextMusicAt += LOOP_SECONDS;
  window.clearTimeout(musicTimer);
  const untilReschedule = Math.max(500, (nextMusicAt - shared.context.currentTime - .7) * 1000);
  musicTimer = window.setTimeout(armNextSection, untilReschedule);
}

export function startGoldenTigerAuthoredScore(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return false;
  const shared = graph();
  if (!shared) return false;
  if (musicRunning) return true;
  musicRunning = true;
  nextMusicAt = shared.context.currentTime + .055;
  armNextSection();
  return true;
}

export function stopGoldenTigerAuthoredScore() {
  musicRunning = false;
  nextMusicAt = 0;
  if (typeof window !== "undefined") window.clearTimeout(musicTimer);
  musicTimer = 0;
  for (const source of liveSources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  liveSources.clear();
}

export function playGoldenTigerAuthoredCue(cue: GoldenTigerAuthoredCue, enabled: boolean, options: CueOptions = {}) {
  if (!enabled) return false;
  const shared = graph();
  if (!shared) return false;
  const now = shared.context.currentTime + .006;
  const intensity = Math.max(.45, Math.min(1.25, options.intensity ?? 1));
  const pan = Math.max(-.62, Math.min(.62, options.pan ?? 0));

  switch (cue) {
    case "spin":
      startGoldenTigerAuthoredScore(true);
      noiseHit(now, .19, .055 * intensity, 380, 2900);
      pluck(hz(0, -1), now, .18, .035 * intensity, 0, true);
      break;
    case "reel-loop":
      noiseHit(now, .48, .023 * intensity, 300, 1700, pan);
      break;
    case "reel-stop": {
      const column = Math.max(0, Math.min(2, Math.trunc(options.column ?? 0)));
      const root = hz([0, 2, 4][column] ?? 0, -1);
      noiseHit(now, .085, (.067 + column * .007) * intensity, 520, 3600, pan);
      pluck(root, now + .006, .22, (.06 + column * .006) * intensity, pan, true);
      pluck(root * 2, now + .018, .12, .024 * intensity, pan);
      break;
    }
    case "anticipation":
      [0, 2, 4, 7].forEach((step, index) => pluck(hz(step), now + index * .075, .34, .038 * intensity, (index - 1.5) * .1, true));
      noiseHit(now + .12, .34, .018 * intensity, 900, 5200);
      break;
    case "symbol-land":
      pluck(hz(9), now, .18, .045 * intensity, pan, true);
      noiseHit(now, .045, .025 * intensity, 1700, 6000, pan);
      break;
    case "feature-trigger":
      chimeStack(hz(0), now, .052 * intensity, .07);
      chimeStack(hz(7), now + .25, .042 * intensity, .055);
      break;
    case "sticky-land":
      noiseHit(now, .07, .04 * intensity, 900, 4200, pan);
      pluck(hz(4), now, .3, .055 * intensity, pan, true);
      pluck(hz(9), now + .06, .34, .032 * intensity, pan);
      break;
    case "small-win":
      [0, 4, 7].forEach((step, index) => pluck(hz(step), now + index * .055, .34, .04 * intensity, (index - 1) * .1, true));
      break;
    case "win":
      chimeStack(hz(0), now, .052 * intensity);
      break;
    case "big-win":
      noiseHit(now, .18, .06 * intensity, 600, 5200);
      chimeStack(hz(0), now + .02, .068 * intensity, .07);
      chimeStack(hz(7), now + .31, .05 * intensity, .055);
      break;
    case "full-grid":
      noiseHit(now, .24, .075 * intensity, 500, 6400);
      chimeStack(hz(0), now, .074 * intensity, .065);
      chimeStack(hz(9), now + .35, .065 * intensity, .06);
      pad([hz(0, -1), hz(4, -1), hz(7, -1), hz(9, -1)], now, 1.35, .03 * intensity);
      break;
    case "button":
      pluck(hz(0, -2), now, .08, .035 * intensity, pan, true);
      break;
    case "toggle":
      pluck(hz(7, -1), now, .11, .032 * intensity, pan, true);
      pluck(hz(12, -1), now + .035, .12, .022 * intensity, pan);
      break;
  }
  return true;
}
