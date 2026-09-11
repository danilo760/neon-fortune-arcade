import {
  startGoldenTigerAuthoredScore,
  stopGoldenTigerAuthoredScore,
} from "./goldenTigerScore";
import { getArcadeMusicGraph } from "./sound";

type RiserState = {
  root: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

let riserState: RiserState | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(context: AudioContext) {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;

  const length = Math.max(1, Math.floor(context.sampleRate * 0.45));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x5f3759df;
  for (let index = 0; index < data.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[index] = ((seed / 0xffffffff) * 2 - 1) * 0.82;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Anticipation deliberately replaces the normal authored score for a short
 * riser. It never decides whether anticipation happens; gameplay already did.
 */
export function startGoldenTigerAnticipationRiser(enabled: boolean) {
  if (!enabled) return false;
  if (riserState) return true;

  const shared = getArcadeMusicGraph();
  if (!shared) return false;

  stopGoldenTigerAuthoredScore();

  const { context, destination } = shared;
  const now = context.currentTime + 0.008;
  const root = context.createGain();
  root.gain.setValueAtTime(0.0001, now);
  root.gain.exponentialRampToValueAtTime(0.064, now + 0.52);
  root.connect(destination);

  const low = context.createOscillator();
  low.type = "sawtooth";
  low.frequency.setValueAtTime(82, now);
  low.frequency.exponentialRampToValueAtTime(310, now + 0.9);
  const lowGain = context.createGain();
  lowGain.gain.value = 0.42;
  low.connect(lowGain).connect(root);

  const high = context.createOscillator();
  high.type = "triangle";
  high.frequency.setValueAtTime(196, now);
  high.frequency.exponentialRampToValueAtTime(1175, now + 0.9);
  const highGain = context.createGain();
  highGain.gain.value = 0.22;
  high.connect(highGain).connect(root);

  const noise = context.createBufferSource();
  noise.buffer = getNoiseBuffer(context);
  noise.loop = true;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(720, now);
  band.frequency.exponentialRampToValueAtTime(4200, now + 0.9);
  band.Q.value = 0.62;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.18;
  noise.connect(band).connect(noiseGain).connect(root);

  low.start(now);
  high.start(now);
  noise.start(now);

  riserState = {
    root,
    sources: [low, high, noise],
    nodes: [lowGain, highGain, band, noiseGain],
  };
  return true;
}

export function stopGoldenTigerAnticipationRiser(enabled: boolean, resumeScore = true) {
  const state = riserState;
  riserState = null;
  if (!state) return false;

  const shared = getArcadeMusicGraph();
  if (shared) {
    const now = shared.context.currentTime;
    state.root.gain.cancelScheduledValues(now);
    state.root.gain.setValueAtTime(Math.max(0.0001, state.root.gain.value), now);
    state.root.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    for (const source of state.sources) {
      try { source.stop(now + 0.065); } catch {}
    }
  } else {
    for (const source of state.sources) {
      try { source.stop(); } catch {}
    }
  }

  const cleanup = () => {
    for (const source of state.sources) {
      try { source.disconnect(); } catch {}
    }
    for (const node of state.nodes) {
      try { node.disconnect(); } catch {}
    }
    try { state.root.disconnect(); } catch {}
    if (resumeScore) startGoldenTigerAuthoredScore(enabled);
  };

  if (typeof window === "undefined") cleanup();
  else window.setTimeout(cleanup, 78);

  return true;
}
