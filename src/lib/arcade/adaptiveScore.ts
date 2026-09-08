import { getArcadeMusicGraph } from "./sound";

export type AdaptiveScoreTheme = "tiger" | "olympus" | "candy" | "mines" | "plinko";

type ScoreSpec = {
  bpm: number;
  rootHz: number;
  scale: readonly number[];
  bass: readonly number[];
  lead: readonly number[];
  chord: readonly number[];
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  colorHz: number;
};

const SCORE_SPECS: Record<AdaptiveScoreTheme, ScoreSpec> = {
  tiger: {
    bpm: 96,
    rootHz: 98,
    scale: [0, 3, 5, 7, 10, 12],
    bass: [0, 0, 5, 3, 0, 7, 5, 3],
    lead: [4, -1, 2, -1, 5, 4, 2, -1, 4, -1, 3, 2, 5, -1, 4, 2],
    chord: [0, 3, 7],
    leadWave: "triangle",
    bassWave: "sine",
    colorHz: 2100,
  },
  olympus: {
    bpm: 78,
    rootHz: 55,
    scale: [0, 2, 3, 7, 10, 12],
    bass: [0, 0, 3, 0, 5, 3, 0, 7],
    lead: [3, -1, -1, 2, 4, -1, 3, -1, 5, -1, 4, 3, 2, -1, 4, -1],
    chord: [0, 3, 7],
    leadWave: "sawtooth",
    bassWave: "sine",
    colorHz: 1450,
  },
  candy: {
    bpm: 116,
    rootHz: 130.81,
    scale: [0, 2, 4, 7, 9, 12],
    bass: [0, 4, 3, 4, 0, 5, 3, 4],
    lead: [4, 2, 5, 4, 3, 2, 4, 5, 4, 3, 2, 1, 3, 4, 5, 3],
    chord: [0, 4, 7],
    leadWave: "triangle",
    bassWave: "triangle",
    colorHz: 3200,
  },
  mines: {
    bpm: 68,
    rootHz: 43.65,
    scale: [0, 1, 3, 6, 7, 10, 12],
    bass: [0, 0, 3, 0, 6, 3, 1, 0],
    lead: [-1, 3, -1, -1, 4, -1, 2, -1, -1, 5, -1, 3, -1, -1, 4, -1],
    chord: [0, 3, 6],
    leadWave: "sine",
    bassWave: "sine",
    colorHz: 920,
  },
  plinko: {
    bpm: 108,
    rootHz: 110,
    scale: [0, 2, 5, 7, 9, 12],
    bass: [0, 0, 3, 4, 0, 3, 5, 4],
    lead: [4, -1, 3, 5, 2, -1, 4, 3, 5, -1, 4, 2, 3, -1, 5, 4],
    chord: [0, 5, 9],
    leadWave: "sine",
    bassWave: "triangle",
    colorHz: 2400,
  },
};

type ScoreRuntime = {
  context: AudioContext;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  filter: BiquadFilterNode;
  theme: AdaptiveScoreTheme;
  energy: number;
  step: number;
  nextStepAt: number;
  timer: ReturnType<typeof globalThis.setTimeout> | null;
  observer: MutationObserver | null;
  sources: Set<OscillatorNode>;
};

let runtime: ScoreRuntime | null = null;
let requestedTheme: AdaptiveScoreTheme | null = null;
let requestedEnabled = false;
let unlockBound = false;

function semitoneRatio(semitones: number) {
  return 2 ** (semitones / 12);
}

function clampEnergy(value: number) {
  return Math.max(0.56, Math.min(1.42, value));
}

function inferEnergy(theme: AdaptiveScoreTheme) {
  if (typeof document === "undefined") return 0.72;

  if (theme === "tiger") {
    const phase = document.querySelector<HTMLElement>(".gt-hw-machine")?.dataset["phase"] ?? "idle";
    if (phase.includes("full") || phase.includes("win")) return 1.4;
    if (phase.includes("feature-lock") || phase.includes("feature-intro")) return 1.32;
    if (phase.includes("feature") || phase.includes("anticip")) return 1.18;
    if (phase.includes("spin") || phase.includes("brak")) return 1.02;
    return 0.72;
  }

  if (theme === "olympus") {
    const machine = document.querySelector<HTMLElement>(".osp-machine");
    const phase = machine?.dataset["phase"] ?? "idle";
    if (phase === "storm-impact" || phase === "level-up") return 1.4;
    if (phase === "storm-charge" || phase.includes("bonus")) return 1.26;
    if (["cluster", "collapse", "refill"].includes(phase)) return 1.12;
    if (["spin", "landing"].includes(phase)) return 1.02;
    return 0.7;
  }

  if (theme === "candy") {
    const machine = document.querySelector<HTMLElement>(".ccp-machine");
    const phase = machine?.dataset["phase"] ?? "idle";
    if (phase === "bomb-burst" || phase === "retrigger") return 1.4;
    if (phase === "bomb-birth" || phase.includes("bonus")) return 1.25;
    if (["cluster", "collapse", "refill"].includes(phase)) return 1.13;
    if (["spin", "landing", "anticipation"].includes(phase)) return 1.03;
    return 0.72;
  }

  if (theme === "mines") {
    const cabinet = document.querySelector<HTMLElement>(".mines-premium__cabinet");
    const reveal = cabinet?.dataset["revealPhase"] ?? "idle";
    const status = cabinet?.dataset["roundStatus"] ?? "idle";
    if (reveal === "explode") return 1.4;
    if (reveal === "danger") return 1.28;
    if (reveal === "cashout" || reveal === "gem") return 1.12;
    if (status === "playing") return 0.92;
    return 0.64;
  }

  const machine = document.querySelector<HTMLElement>(".plinko-ref-machine");
  if (machine?.classList.contains("is-celebrating")) return 1.4;
  if (document.querySelector(".plinko-ref-ball-layer")) return 1.08;
  return 0.68;
}

function setRuntimeEnergy(value: number) {
  if (!runtime) return;
  runtime.energy = clampEnergy(value);
  const now = runtime.context.currentTime;
  const target = 0.032 + (runtime.energy - 0.56) * 0.022;
  runtime.master.gain.cancelScheduledValues(now);
  runtime.master.gain.setTargetAtTime(Math.max(0.018, target), now, 0.14);
  runtime.filter.frequency.setTargetAtTime(
    SCORE_SPECS[runtime.theme].colorHz * (0.82 + runtime.energy * 0.28),
    now,
    0.18,
  );
}

function scheduleTone(
  score: ScoreRuntime,
  frequency: number,
  start: number,
  duration: number,
  gain: number,
  wave: OscillatorType,
  pan = 0,
  endFrequency?: number,
) {
  const osc = score.context.createOscillator();
  const amp = score.context.createGain();
  const panner = typeof score.context.createStereoPanner === "function" ? score.context.createStereoPanner() : null;
  osc.type = wave;
  osc.frequency.setValueAtTime(Math.max(22, frequency), start);
  if (endFrequency && endFrequency > 0) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + Math.min(0.024, duration * 0.18));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  if (panner) {
    panner.pan.value = Math.max(-0.55, Math.min(0.55, pan));
    osc.connect(amp).connect(panner).connect(score.filter);
  } else {
    osc.connect(amp).connect(score.filter);
  }
  score.sources.add(osc);
  osc.onended = () => {
    score.sources.delete(osc);
    try { osc.disconnect(); } catch {}
    try { amp.disconnect(); } catch {}
    try { panner?.disconnect(); } catch {}
  };
  osc.start(start);
  osc.stop(start + duration + 0.025);
}

function scheduleStep(score: ScoreRuntime, step: number, at: number) {
  const spec = SCORE_SPECS[score.theme];
  const eighth = (60 / spec.bpm) / 2;
  const energy = score.energy;
  const scaleNote = (index: number, octave = 0) => {
    const safe = Math.max(0, Math.min(spec.scale.length - 1, index));
    return spec.rootHz * semitoneRatio((spec.scale[safe] ?? 0) + octave * 12);
  };

  if (step % 2 === 0) {
    const bassIndex = spec.bass[Math.floor(step / 2) % spec.bass.length] ?? 0;
    scheduleTone(score, scaleNote(bassIndex), at, eighth * 1.7, 0.13, spec.bassWave, -0.08);
  }

  if (step % 8 === 0) {
    spec.chord.forEach((semitone, index) => {
      scheduleTone(
        score,
        spec.rootHz * semitoneRatio(semitone + 12),
        at,
        eighth * (energy > 1.15 ? 7.2 : 5.2),
        0.025 - index * 0.004,
        "sine",
        (index - 1) * 0.18,
      );
    });
  }

  const leadIndex = spec.lead[step % spec.lead.length] ?? -1;
  const leadThreshold = score.theme === "mines" ? 0.88 : 0.72;
  if (leadIndex >= 0 && energy >= leadThreshold) {
    const octave = energy > 1.2 && step % 4 === 0 ? 2 : 1;
    scheduleTone(
      score,
      scaleNote(leadIndex, octave),
      at + (step % 2 ? eighth * 0.08 : 0),
      eighth * (energy > 1.18 ? 0.78 : 0.58),
      0.045 + Math.max(0, energy - 0.8) * 0.018,
      spec.leadWave,
      step % 4 === 1 ? -0.24 : step % 4 === 3 ? 0.24 : 0,
    );
  }

  if (energy > 1.05 && step % 2 === 1) {
    const accent = spec.rootHz * semitoneRatio(24 + (spec.scale[(step + 2) % spec.scale.length] ?? 0));
    scheduleTone(score, accent, at, eighth * 0.2, 0.016, "sine", step % 4 === 1 ? -0.34 : 0.34, accent * 0.92);
  }

  if (energy > 1.28 && step % 4 === 0) {
    scheduleTone(score, spec.rootHz * 0.52, at, eighth * 0.48, 0.09, "sine", 0, spec.rootHz * 0.38);
  }
}

function schedulerTick() {
  const score = runtime;
  if (!score || score.context.state !== "running") return;
  const spec = SCORE_SPECS[score.theme];
  const eighth = (60 / spec.bpm) / 2;
  const horizon = score.context.currentTime + 0.24;

  while (score.nextStepAt < horizon) {
    scheduleStep(score, score.step, score.nextStepAt);
    score.step = (score.step + 1) % 128;
    score.nextStepAt += eighth;
  }

  score.timer = globalThis.setTimeout(schedulerTick, 72);
}

function disconnectObserver() {
  if (!runtime?.observer) return;
  runtime.observer.disconnect();
  runtime.observer = null;
}

function bindPhaseObserver(theme: AdaptiveScoreTheme) {
  if (!runtime || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
  disconnectObserver();
  const sync = () => setRuntimeEnergy(inferEnergy(theme));
  runtime.observer = new MutationObserver(sync);
  runtime.observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-phase", "data-reveal-phase", "data-round-status"],
  });
  sync();
}

function stopRuntime() {
  const score = runtime;
  runtime = null;
  if (!score) return;
  if (score.timer) globalThis.clearTimeout(score.timer);
  score.observer?.disconnect();
  for (const source of score.sources) {
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  score.sources.clear();
  const now = score.context.currentTime;
  try {
    score.master.gain.cancelScheduledValues(now);
    score.master.gain.setTargetAtTime(0.0001, now, 0.04);
  } catch {}
  globalThis.setTimeout(() => {
    try { score.filter.disconnect(); } catch {}
    try { score.master.disconnect(); } catch {}
    try { score.compressor.disconnect(); } catch {}
  }, 160);
}

function startRuntime(theme: AdaptiveScoreTheme) {
  stopRuntime();
  const graph = getArcadeMusicGraph();
  if (!graph) return;
  const { context, destination } = graph;

  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = 0.0001;
  filter.type = "lowpass";
  filter.frequency.value = SCORE_SPECS[theme].colorHz;
  filter.Q.value = 0.34;
  compressor.threshold.value = -16;
  compressor.knee.value = 16;
  compressor.ratio.value = 2.4;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;
  filter.connect(master).connect(compressor).connect(destination);

  runtime = {
    context,
    master,
    compressor,
    filter,
    theme,
    energy: 0.7,
    step: 0,
    nextStepAt: context.currentTime + 0.08,
    timer: null,
    observer: null,
    sources: new Set(),
  };

  const begin = () => {
    if (!runtime || runtime.context !== context || runtime.theme !== theme) return;
    setRuntimeEnergy(inferEnergy(theme));
    bindPhaseObserver(theme);
    if (!runtime.timer) schedulerTick();
  };

  if (context.state === "running") begin();
  else void context.resume().then(begin).catch(() => undefined);
}

function unlockRequestedScore() {
  if (!requestedEnabled || !requestedTheme) return;
  if (!runtime || runtime.theme !== requestedTheme) startRuntime(requestedTheme);
  const score = runtime;
  if (!score) return;
  void score.context.resume().then(() => {
    if (!runtime || runtime !== score) return;
    if (!score.timer) schedulerTick();
    bindPhaseObserver(score.theme);
  }).catch(() => undefined);
}

function ensureUnlockBinding() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => unlockRequestedScore();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
}

export function setAdaptiveScore(theme: AdaptiveScoreTheme | null, enabled: boolean) {
  requestedTheme = theme;
  requestedEnabled = enabled && theme !== null;
  ensureUnlockBinding();

  if (!requestedEnabled || !requestedTheme) {
    stopRuntime();
    return;
  }

  if (runtime?.theme === requestedTheme) {
    setRuntimeEnergy(inferEnergy(requestedTheme));
    return;
  }

  startRuntime(requestedTheme);
}
