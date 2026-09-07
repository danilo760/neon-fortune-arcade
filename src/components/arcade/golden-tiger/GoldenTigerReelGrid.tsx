import { memo, type CSSProperties } from "react";

import {
  SYMBOL_ORDER,
  type GoldenTigerSymbolId,
} from "@/lib/arcade/golden-tiger/goldenTigerConfig";
import type { LineWin } from "@/lib/arcade/golden-tiger/goldenTigerMath";

import "./GoldenTigerReelGrid.css";
import { GoldenTigerSymbol } from "./GoldenTigerSymbols";

interface ReelGridProps {
  grid: readonly GoldenTigerSymbolId[];
  isSpinning: boolean;
  isTurbo: boolean;
  respinActive: boolean;
  respinRolling: boolean;
  lockedIndices: ReadonlySet<number>;
  winningIndices: ReadonlySet<number>;
  activeLines: readonly LineWin[];
  stoppedColumns: number;
}

const CELL_CENTERS = [
  { x: "16.66%", y: "16.66%" },
  { x: "50%", y: "16.66%" },
  { x: "83.33%", y: "16.66%" },
  { x: "16.66%", y: "50%" },
  { x: "50%", y: "50%" },
  { x: "83.33%", y: "50%" },
  { x: "16.66%", y: "83.33%" },
  { x: "50%", y: "83.33%" },
  { x: "83.33%", y: "83.33%" },
];

function ReelMotion({ index, isTurbo }: { index: number; isTurbo: boolean }) {
  const offset = (index * 2) % SYMBOL_ORDER.length;
  const rotated = [...SYMBOL_ORDER.slice(offset), ...SYMBOL_ORDER.slice(0, offset)];
  const sequence = [...rotated, ...rotated];
  const speed = (isTurbo ? 145 : 265) + (index % 3) * (isTurbo ? 8 : 14);
  const style = { "--gt-reel-speed": `${speed}ms` } as CSSProperties;

  return (
    <div className="gt-reel-motion" style={style} aria-hidden="true">
      <div className="gt-reel-motion__track">
        {sequence.map((symbolId, sequenceIndex) => (
          <div className="gt-reel-motion__item" key={`${index}-${sequenceIndex}-${symbolId}`}>
            <GoldenTigerSymbol id={symbolId} />
          </div>
        ))}
      </div>
      <span className="gt-reel-motion__streak" />
      <span className="gt-reel-motion__veil" />
    </div>
  );
}

export const GoldenTigerReelGrid = memo(function GoldenTigerReelGrid({
  grid,
  isSpinning,
  isTurbo,
  respinActive,
  respinRolling,
  lockedIndices,
  winningIndices,
  activeLines,
  stoppedColumns,
}: ReelGridProps) {
  const hasWins = winningIndices.size > 0;

  return (
    <div className="relative w-full aspect-square max-w-[390px] mx-auto p-2.5 rounded-2xl border-4 border-yellow-500/90 bg-gradient-to-b from-[#3b040a] via-[#1f0105] to-[#3b040a] shadow-[0_0_35px_rgba(234,179,8,0.4),inset_0_0_20px_rgba(0,0,0,0.8)] overflow-hidden select-none">
      <div className="absolute inset-1 rounded-xl border border-yellow-400/30 pointer-events-none" />

      <div className="relative grid grid-cols-3 grid-rows-3 size-full gap-1.5 z-10">
        {grid.map((symbolId, idx) => {
          const col = idx % 3;
          const isLocked = lockedIndices.has(idx);
          const isWinning = winningIndices.has(idx);
          const isDimmed = hasWins && !isWinning;
          const baseSpinning = isSpinning && !respinActive && col >= stoppedColumns;
          const baseLanding = isSpinning && !respinActive && col < stoppedColumns;
          const respinSpinning = respinActive && respinRolling && !isLocked;
          const respinReveal = respinActive && !respinRolling && !isLocked;
          const showMotion = baseSpinning || respinSpinning;

          return (
            <div
              key={idx}
              className={`relative rounded-xl overflow-hidden border border-amber-900/60 bg-gradient-to-b from-[#2a0408] to-[#140003] flex items-center justify-center transition-[opacity,filter,box-shadow,transform] duration-200 ${
                isWinning
                  ? "ring-2 ring-yellow-400 bg-amber-500/20 shadow-[0_0_16px_rgba(250,204,21,0.5)] z-20 scale-[1.02]"
                  : isDimmed
                    ? "opacity-35 grayscale-[40%]"
                    : ""
              } ${isLocked ? "ring-2 ring-yellow-300/80 bg-yellow-950/40" : ""} ${
                baseLanding ? "gt-reel-cell--landing" : ""
              } ${respinReveal ? "gt-reel-cell--respin-reveal" : ""}`}
            >
              <div className="gt-reel-symbol-host absolute inset-0">
                <GoldenTigerSymbol id={symbolId} isWinning={isWinning} isLocked={isLocked} />
              </div>

              {showMotion && <ReelMotion index={idx} isTurbo={isTurbo} />}
            </div>
          );
        })}
      </div>

      {hasWins && activeLines.length > 0 && (
        <svg
          className="absolute inset-2.5 size-[calc(100%-20px)] pointer-events-none z-30"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {activeLines.map((line, lineIndex) => {
            const [p0, p1, p2] = line.positions;
            const c0 = CELL_CENTERS[p0];
            const c1 = CELL_CENTERS[p1];
            const c2 = CELL_CENTERS[p2];
            if (!c0 || !c1 || !c2) return null;

            const points = `${c0.x.replace("%", "")},${c0.y.replace("%", "")} ${c1.x.replace("%", "")},${c1.y.replace("%", "")} ${c2.x.replace("%", "")},${c2.y.replace("%", "")}`;

            return (
              <g key={`${line.positions.join("-")}-${lineIndex}`} className="animate-pulse">
                <polyline
                  points={points}
                  fill="none"
                  stroke="#ff2a8a"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.88"
                  filter="drop-shadow(0 0 4px #ff2a8a)"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke="#fff6cb"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
});
