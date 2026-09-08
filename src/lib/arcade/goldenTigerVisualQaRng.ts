type Rng = () => number;

type VisualQaRandomState = {
  queue: number[];
  fallback: number;
  calls: number;
};

let cachedSequence = "";
let cachedValues: number[] = [];
let cachedIndex = 0;
let cachedFallback = 0.9;

/**
 * Visual-QA-only deterministic RNG bridge.
 *
 * The Vite flag is enabled only by the dedicated Golden Tiger visual workflow.
 * Normal production/preview builds compile this path disabled and continue to
 * use the caller-provided RNG (normally Math.random).
 */
export function resolveGoldenTigerVisualQaRng(fallback: Rng): Rng {
  if (import.meta.env.VITE_GOLDEN_TIGER_VISUAL_QA !== "1" || typeof window === "undefined") {
    return fallback;
  }

  const injected = (window as typeof window & { __gtQaRandom?: VisualQaRandomState }).__gtQaRandom;
  if (injected && Array.isArray(injected.queue)) {
    return () => {
      injected.calls += 1;
      const value = injected.queue.shift();
      return value ?? injected.fallback;
    };
  }

  const params = new URLSearchParams(window.location.search);
  const sequence = params.get("__gt_rng");
  if (!sequence) return fallback;

  if (sequence !== cachedSequence) {
    cachedSequence = sequence;
    cachedValues = sequence
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    cachedIndex = 0;
    const requestedFallback = Number(params.get("__gt_rng_fallback"));
    cachedFallback = Number.isFinite(requestedFallback) ? requestedFallback : 0.9;
  }

  return () => {
    const value = cachedValues[cachedIndex];
    cachedIndex += 1;
    return value ?? cachedFallback;
  };
}

export function resetGoldenTigerVisualQaRngForTests() {
  cachedSequence = "";
  cachedValues = [];
  cachedIndex = 0;
  cachedFallback = 0.9;
}
