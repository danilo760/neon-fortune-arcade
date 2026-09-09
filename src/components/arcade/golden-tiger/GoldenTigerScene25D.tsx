import { architecture, backplate, foreground, mascotPlatform, reelsFrame } from "./GoldenTigerSceneAssets";

export type GoldenTigerLightingMode = "idle" | "spin" | "feature" | "win" | "full";

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
      <span className="gt-scene-vignette" />
    </div>
  );
}
