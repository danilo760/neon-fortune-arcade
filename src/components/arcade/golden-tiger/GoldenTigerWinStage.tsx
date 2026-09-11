import type { CSSProperties } from "react";
import { AnimatedWinCounter } from "../AnimatedWinCounter";
import { coinParticle } from "./GoldenTigerSceneAssets";
import type { GoldenTigerWinBeat } from "@/lib/arcade/goldenTigerWinTimeline";
import type { GoldenTigerWinTier } from "@/lib/arcade/goldenTigerMath";
import { cn } from "@/lib/utils";

const PARTICLES = Array.from({ length: 24 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  const lane = 34 + (index % 6) * 24;
  return {
    xApex: side * lane * 0.58,
    xEnd: side * lane,
    yApex: -(150 + (index % 5) * 34),
    yEnd: -(22 + (index % 4) * 18),
    rotate: side * (180 + (index % 5) * 74),
    rotateApex: side * (104 + (index % 5) * 43),
    scale: 0.46 + (index % 5) * 0.12,
    scaleEnd: (0.46 + (index % 5) * 0.12) * 0.78,
    blur: index % 7 === 0 ? 1.2 : index % 4 === 0 ? .55 : 0,
    delay: (index % 8) * 28,
  };
});

export function GoldenTigerWinStage({
  value,
  tier,
  fullGrid,
  beat,
  countUpMs,
  reducedMotion,
}: {
  value: number;
  tier: GoldenTigerWinTier;
  fullGrid: boolean;
  beat: GoldenTigerWinBeat;
  countUpMs: number;
  reducedMotion: boolean;
}) {
  const title = fullGrid ? "TELA CHEIA" : tier === "super" ? "SUPER MEGA GANHO" : tier === "mega" ? "MEGA GANHO" : "GRANDE GANHO";
  return (
    <div
      className={cn("gt-commercial-win", fullGrid && "is-full", (tier === "mega" || tier === "super") && "is-mega")}
      data-win-beat={beat ?? "impact"}
      aria-live="polite"
    >
      <span className="gt-commercial-win__dimmer" aria-hidden />
      <span className="gt-commercial-win__flash" aria-hidden />
      <div className="gt-commercial-win__particles" aria-hidden>
        {PARTICLES.map((particle, index) => (
          <img
            key={index}
            src={coinParticle}
            alt=""
            draggable={false}
            style={{
              "--gt-p-x-apex": `${particle.xApex}px`,
              "--gt-p-x-end": `${particle.xEnd}px`,
              "--gt-p-y-apex": `${particle.yApex}px`,
              "--gt-p-y-end": `${particle.yEnd}px`,
              "--gt-p-rotate": `${particle.rotate}deg`,
              "--gt-p-rotate-apex": `${particle.rotateApex}deg`,
              "--gt-p-scale": particle.scale,
              "--gt-p-scale-end": particle.scaleEnd,
              "--gt-p-blur": `${particle.blur}px`,
              "--gt-p-delay": `${particle.delay}ms`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="gt-commercial-win__content">
        <span className="gt-commercial-win__title">{title}</span>
        <AnimatedWinCounter
          value={beat === "impact" ? 0 : value}
          duration={reducedMotion ? 0 : countUpMs}
          curve="front-load-80"
        />
        {fullGrid ? <small>GANHOS × 10</small> : null}
      </div>
    </div>
  );
}
