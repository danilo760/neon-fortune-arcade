type Rng = () => number;

type CandyVisualQaRandomState = {
  queue: number[];
  fallback: number;
  calls: number;
};

/**
 * Deterministic RNG bridge used only by the Candy visual workflow.
 * The dedicated Vite flag is absent from normal production/preview builds,
 * so Render continues to use the caller-provided RNG unchanged.
 */
export function resolveCandyCascadeVisualQaRng(fallback: Rng): Rng {
  const visualQaEnabled = import.meta.env.VITE_CANDY_CASCADE_VISUAL_QA === "1";

  if (!visualQaEnabled || typeof window === "undefined") return fallback;

  const injected = (window as typeof window & {
    __candyQaRandom?: CandyVisualQaRandomState;
  }).__candyQaRandom;
  if (!injected || !Array.isArray(injected.queue)) return fallback;

  return () => {
    injected.calls += 1;
    const value = injected.queue.shift();
    return value ?? injected.fallback;
  };
}
