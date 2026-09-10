import { memo } from "react";
import type { CSSProperties } from "react";
import type { GoldenTigerSymbolId } from "@/lib/arcade/goldenTigerMath";

import premiumAtlas from "@/assets/golden-tiger/premium-symbol-atlas.webp";
import "./GoldenTigerSymbols.css";

type Props = {
  id: GoldenTigerSymbolId;
  isWinning?: boolean;
  className?: string;
};

const LABEL: Record<GoldenTigerSymbolId, string> = {
  orange: "Laranja da sorte",
  jade: "Guardião de jade",
  lantern: "Lanterna vermelha",
  firecracker: "Fogos da fortuna",
  ingot: "Lingote dourado",
  fortuneBag: "Bolsa da fortuna",
  lion: "Guardião da fortuna",
  wild: "Wild Golden Tiger",
};

const POSITION: Record<GoldenTigerSymbolId, { x: string; y: string }> = {
  orange: { x: "0%", y: "0%" },
  jade: { x: "-100%", y: "0%" },
  lantern: { x: "-200%", y: "0%" },
  firecracker: { x: "-300%", y: "0%" },
  ingot: { x: "0%", y: "-100%" },
  fortuneBag: { x: "-100%", y: "-100%" },
  lion: { x: "-200%", y: "-100%" },
  wild: { x: "-300%", y: "-100%" },
};

export const GoldenTigerSymbol = memo(function GoldenTigerSymbol({
  id,
  isWinning = false,
  className = "",
}: Props) {
  const position = POSITION[id];
  const style = {
    "--gt-premium-symbol-x": position.x,
    "--gt-premium-symbol-y": position.y,
  } as CSSProperties;

  return (
    <div
      className={`gt-hw-symbol gt-hw-symbol--raster ${isWinning ? "is-winning" : ""} ${className}`}
      data-symbol={id}
      aria-label={LABEL[id]}
      style={style}
    >
      <span className="gt-hw-symbol-raster" aria-hidden>
        <img
          src={premiumAtlas}
          alt=""
          loading="eager"
          decoding="async"
          draggable={false}
          data-symbol-art={id}
        />
      </span>
      {id === "wild" ? <span className="gt-hw-symbol-wild-label" aria-hidden>WILD</span> : null}
    </div>
  );
});
