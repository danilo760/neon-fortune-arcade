import type { CSSProperties } from "react";
import { architecture, backplate, foreground, mascotPlatform, reelsFrame } from "./GoldenTigerSceneAssets";

export type GoldenTigerLightingMode = "idle" | "spin" | "feature" | "win" | "full";

const SCENE_PARTICLES = Array.from({ length: 12 }, (_, index) => ({
  left: 8 + ((index * 31) % 84),
  top: 18 + ((index * 23) % 66),
  delay: -((index * 0.37) % 3.4),
  duration: 2.8 + (index % 5) * 0.42,
  size: 2 + (index % 3),
}));

export function GoldenTigerScene25D({ lighting }: { lighting: GoldenTigerLightingMode }) {
  return (
    <div className="gt-commercial-scene" data-lighting={lighting} aria-hidden>
      <img className="gt-scene-layer layer-bg-backplate" src={backplate} alt="" draggable={false} />
      <img className="gt-scene-layer layer-bg-architecture" src={architecture} alt="" draggable={false} />
      <img className="gt-scene-layer layer-reels-frame" src={reelsFrame} alt="" draggable={false} />
      <img className="gt-scene-layer layer-mascot-platform" src={mascotPlatform} alt="" draggable={false} />
      <img className="gt-scene-layer layer-foreground" src={foreground} alt="" draggable={false} />
      <span className="gt-scene-light gt-scene-light--ambient" />
      <span className="gt-scene-light gt-scene-light--spot" />
      <span className="gt-scene-particles">
        {SCENE_PARTICLES.map((particle, index) => (
          <i
            key={index}
            style={{
              "--gt-scene-p-left": `${particle.left}%`,
              "--gt-scene-p-top": `${particle.top}%`,
              "--gt-scene-p-delay": `${particle.delay}s`,
              "--gt-scene-p-duration": `${particle.duration}s`,
              "--gt-scene-p-size": `${particle.size}px`,
            } as CSSProperties}
          />
        ))}
      </span>
      <span className="gt-scene-vignette" />
    </div>
  );
}
