import type { CSSProperties } from "react";
import { AnimatedWinCounter } from "../AnimatedWinCounter";
import { coinParticle } from "./GoldenTigerSceneAssets";
import type { GoldenTigerWinBeat } from "@/lib/arcade/goldenTigerWinTimeline";
import type { GoldenTigerWinTier } from "@/lib/arcade/goldenTigerMath";
import { cn } from "@/lib/utils";

const PARTICLES = Array.from({ length: 18 }, (_, index) => ({
  angle: (index * 137.5) % 360,
  distance: 78 + (index % 6) * 22,
  scale: 0.48 + (index % 5) * 0.13,
  blur: index % 6 === 0 ? 1.6 : index % 4 === 0 ? .8 : 0,
  delay: (index % 7) * 34,
}));

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
              "--gt-p-angle": `${particle.angle}deg`,
              "--gt-p-distance": `${particle.distance}px`,
              "--gt-p-scale": particle.scale,
              "--gt-p-blur": `${particle.blur}px`,
              "--gt-p-delay": `${particle.delay}ms`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="gt-commercial-win__content">
        <span className="gt-commercial-win__title">{title}</span>
        <AnimatedWinCounter value={beat === "impact" ? 0 : value} duration={reducedMotion ? 0 : countUpMs} />
        {fullGrid ? <small>GANHOS × 10</small> : null}
      </div>
    </div>
  );
}
