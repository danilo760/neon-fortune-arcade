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

const POSITION: Record<GoldenTigerSymbolId, string> = {
  orange: "0% 0%",
  jade: "33.3333% 0%",
  lantern: "66.6667% 0%",
  firecracker: "100% 0%",
  ingot: "0% 100%",
  fortuneBag: "33.3333% 100%",
  lion: "66.6667% 100%",
  wild: "100% 100%",
};

export const GoldenTigerSymbol = memo(function GoldenTigerSymbol({
  id,
  isWinning = false,
  className = "",
}: Props) {
  const style = {
    "--gt-premium-symbol-atlas": `url(${premiumAtlas})`,
    "--gt-premium-symbol-position": POSITION[id],
  } as CSSProperties;

  return (
    <div
      className={`gt-hw-symbol gt-hw-symbol--raster ${isWinning ? "is-winning" : ""} ${className}`}
      data-symbol={id}
      aria-label={LABEL[id]}
      style={style}
    >
      <span className="gt-hw-symbol-raster" aria-hidden />
      {id === "wild" ? <span className="gt-hw-symbol-wild-label" aria-hidden>WILD</span> : null}
    </div>
  );
});
