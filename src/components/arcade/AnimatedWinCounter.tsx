import { useEffect, useRef } from "react";

import { formatCoins } from "@/lib/arcade/format";

type AnimatedWinCounterProps = {
  value: number;
  duration: number;
  className?: string;
  curve?: "standard" | "front-load-80";
};

const TEXT_FRAME_MS = 1000 / 30;

export function animatedWinCounterProgress(progress: number, curve: "standard" | "front-load-80") {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (curve === "front-load-80") {
    if (t <= 0.24) return 0.8 * (1 - (1 - t / 0.24) ** 3);
    return 0.8 + 0.2 * (1 - (1 - (t - 0.24) / 0.76) ** 2.35);
  }
  return 1 - (1 - t) ** 3;
}

export function AnimatedWinCounter({ value, duration, className, curve = "standard" }: AnimatedWinCounterProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const element = elementRef.current;
    if (!element) return;

    const from = displayedRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (duration <= 0 || value <= from || reduced) {
      displayedRef.current = value;
      element.textContent = formatCoins(value);
      return;
    }

    const startedAt = performance.now();
    let lastTextUpdate = startedAt - TEXT_FRAME_MS;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      if (now - lastTextUpdate >= TEXT_FRAME_MS || progress >= 1) {
        const eased = animatedWinCounterProgress(progress, curve);
        const next = Math.round(from + (value - from) * eased);
        displayedRef.current = next;
        element.textContent = formatCoins(next);
        lastTextUpdate = now;
      }

      if (progress < 1) frameRef.current = requestAnimationFrame(frame);
      else frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [curve, duration, value]);

  return <span ref={elementRef} className={className}>{formatCoins(value)}</span>;
}
