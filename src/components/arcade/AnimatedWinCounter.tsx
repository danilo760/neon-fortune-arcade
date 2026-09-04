import { useEffect, useRef } from "react";

import { formatCoins } from "@/lib/arcade/format";

type AnimatedWinCounterProps = {
  value: number;
  duration: number;
  className?: string;
};

const TEXT_FRAME_MS = 1000 / 30;

export function AnimatedWinCounter({ value, duration, className }: AnimatedWinCounterProps) {
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
        const eased = 1 - (1 - progress) ** 3;
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
  }, [duration, value]);

  return <span ref={elementRef} className={className}>{formatCoins(value)}</span>;
}
