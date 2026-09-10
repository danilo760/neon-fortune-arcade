import { getArcadeMusicGraph } from "./sound";

export type GoldenTigerSampleBus = "game" | "impact" | "reward";
export type GoldenTigerSampleOptions = {
  bus?: GoldenTigerSampleBus;
  pan?: number;
  intensity?: number;
  pitch?: number;
  randomPitchPercent?: number;
};

const buffers = new Map<string, AudioBuffer>();
const loads = new Map<string, Promise<AudioBuffer | null>>();
const failed = new Set<string>();
let boundContext: AudioContext | null = null;
const buses = new Map<GoldenTigerSampleBus, GainNode>();
const activeSources = new Set<AudioBufferSourceNode>();

const BUS_LEVEL: Record<GoldenTigerSampleBus, number> = {
  game: 1,
  impact: 1.08,
  reward: .96,
};

function graph() {
  const shared = getArcadeMusicGraph();
  if (!shared) return null;
  if (boundContext !== shared.context) {
    boundContext = shared.context;
    buses.clear();
  }
  return shared;
}

function busNode(bus: GoldenTigerSampleBus) {
  const shared = graph();
  if (!shared) return null;
  let node = buses.get(bus);
  if (!node) {
    node = shared.context.createGain();
    node.gain.value = BUS_LEVEL[bus];
    node.connect(shared.destination);
    buses.set(bus, node);
  }
  return node;
}

async function loadSample(url: string): Promise<AudioBuffer | null> {
  if (buffers.has(url)) return buffers.get(url) ?? null;
  if (failed.has(url) || typeof fetch === "undefined") return null;
  const pending = loads.get(url);
  if (pending) return pending;

  const load = (async () => {
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`sample ${response.status}`);
      const shared = graph();
      if (!shared) return null;
      const decoded = await shared.context.decodeAudioData(await response.arrayBuffer());
      buffers.set(url, decoded);
      return decoded;
    } catch {
      failed.add(url);
      return null;
    } finally {
      loads.delete(url);
    }
  })();
  loads.set(url, load);
  return load;
}

export async function preloadGoldenTigerSampleUrls(urls: readonly string[]) {
  await Promise.allSettled(urls.map((url) => loadSample(url)));
}

/** Shares the arcade AudioContext/master graph. Returns false until a sample is
 * decoded so the caller can immediately use the existing procedural fallback. */
export function playGoldenTigerSampleUrl(url: string, options: GoldenTigerSampleOptions = {}) {
  const buffer = buffers.get(url);
  if (!buffer) {
    if (!failed.has(url)) void loadSample(url);
    return false;
  }

  const shared = graph();
  const destination = busNode(options.bus ?? "game");
  if (!shared || !destination) return false;

  const source = shared.context.createBufferSource();
  const amp = shared.context.createGain();
  const jitter = Math.max(0, Math.min(.05, options.randomPitchPercent ?? 0));
  const random = jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1;
  source.buffer = buffer;
  source.playbackRate.value = Math.max(.82, Math.min(1.22, (options.pitch ?? 1) * random));
  amp.gain.value = Math.max(.12, Math.min(1.16, options.intensity ?? 1));
  source.connect(amp);

  let panner: StereoPannerNode | null = null;
  const pan = Math.max(-.7, Math.min(.7, options.pan ?? 0));
  if (Math.abs(pan) > .01 && typeof shared.context.createStereoPanner === "function") {
    panner = shared.context.createStereoPanner();
    panner.pan.value = pan;
    amp.connect(panner).connect(destination);
  } else {
    amp.connect(destination);
  }

  source.onended = () => {
    activeSources.delete(source);
    try { source.disconnect(); } catch {}
    try { amp.disconnect(); } catch {}
    try { panner?.disconnect(); } catch {}
  };
  activeSources.add(source);
  source.start();
  return true;
}

export function disposeGoldenTigerSampleEngine() {
  loads.clear();
  for (const source of activeSources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  activeSources.clear();
  // Decoded buffers stay cached for the page lifetime so returning to the game
  // does not re-decode the commissioned pack.
}
