import { memo } from "react";
import type { GoldenTigerSymbolId } from "@/lib/arcade/goldenTigerMath";

import orange from "@/assets/golden-tiger/symbols/orange.webp";
import jade from "@/assets/golden-tiger/symbols/jade.webp";
import lantern from "@/assets/golden-tiger/symbols/lantern.webp";
import firecracker from "@/assets/golden-tiger/symbols/firecracker.webp";
import ingot from "@/assets/golden-tiger/symbols/ingot.webp";
import fortuneBag from "@/assets/golden-tiger/symbols/fortuneBag.webp";
import lion from "@/assets/golden-tiger/symbols/lion.webp";
import wild from "@/assets/golden-tiger/symbols/wild.webp";

type CompatibleSymbolId = GoldenTigerSymbolId | "bag";

type Props = {
  id: CompatibleSymbolId;
  isWinning?: boolean;
  isLocked?: boolean;
  className?: string;
};

const ART: Record<GoldenTigerSymbolId, string> = {
  orange,
  jade,
  lantern,
  firecracker,
  ingot,
  fortuneBag,
  lion,
  wild,
};

const LABEL: Record<GoldenTigerSymbolId, string> = {
  orange: "Laranja da sorte",
  jade: "Pingente de jade",
  lantern: "Lanterna vermelha",
  firecracker: "Fogos da fortuna",
  ingot: "Lingote dourado",
  fortuneBag: "Bolsa da fortuna",
  lion: "Medalhão da fortuna",
  wild: "Wild Golden Tiger",
};

export const GoldenTigerSymbol = memo(function GoldenTigerSymbol({
  id,
  isWinning = false,
  isLocked = false,
  className = "",
}: Props) {
  const symbol: GoldenTigerSymbolId = id === "bag" ? "fortuneBag" : id;

  return (
    <div
      className={`gt-hw-symbol ${isWinning ? "is-winning" : ""} ${isLocked ? "is-legacy-locked" : ""} ${className}`}
      data-symbol={symbol}
      aria-label={LABEL[symbol]}
    >
      <span className="gt-hw-symbol-aura" aria-hidden />
      <img
        className="gt-hw-symbol-art"
        src={ART[symbol]}
        alt=""
        draggable={false}
        decoding="async"
      />
      <span className="gt-hw-symbol-sheen" aria-hidden />
    </div>
  );
});
