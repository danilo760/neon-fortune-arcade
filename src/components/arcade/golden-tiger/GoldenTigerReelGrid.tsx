import React, { memo } from "react";
import type { GoldenTigerSymbolId } from "@/lib/arcade/golden-tiger/goldenTigerConfig";
import type { LineWin } from "@/lib/arcade/golden-tiger/goldenTigerMath";
import { GoldenTigerSymbol } from "./GoldenTigerSymbols";

interface ReelGridProps {
  grid: readonly GoldenTigerSymbolId[];
  isSpinning: boolean;
  respinActive: boolean;
  lockedIndices: ReadonlySet<number>;
  winningIndices: ReadonlySet<number>;
  activeLines: readonly LineWin[];
  stoppedColumns: number; // 0 (todos girando) a 3 (todos parados)
}

// Coordenadas das células no grid 3x3 para desenhar as linhas de pagamento conectadas
const CELL_CENTERS = [
  { x: "16.66%", y: "16.66%" }, // 0: col 0, row 0
  { x: "50%", y: "16.66%" },    // 1: col 1, row 0
  { x: "83.33%", y: "16.66%" }, // 2: col 2, row 0
  { x: "16.66%", y: "50%" },    // 3: col 0, row 1
  { x: "50%", y: "50%" },       // 4: col 1, row 1
  { x: "83.33%", y: "50%" },    // 5: col 2, row 1
  { x: "16.66%", y: "83.33%" }, // 6: col 0, row 2
  { x: "50%", y: "83.33%" },    // 7: col 1, row 2
  { x: "83.33%", y: "83.33%" }, // 8: col 2, row 2
];

export const GoldenTigerReelGrid = memo(function GoldenTigerReelGrid({
  grid,
  isSpinning,
  respinActive,
  lockedIndices,
  winningIndices,
  activeLines,
  stoppedColumns,
}: ReelGridProps) {
  const hasWins = winningIndices.size > 0;

  return (
    <div className="relative w-full aspect-square max-w-[390px] mx-auto p-2.5 rounded-2xl border-4 border-yellow-500/90 bg-gradient-to-b from-[#3b040a] via-[#1f0105] to-[#3b040a] shadow-[0_0_35px_rgba(234,179,8,0.4),inset_0_0_20px_rgba(0,0,0,0.8)] overflow-hidden select-none">
      {/* Moldura de fundo ornamental */}
      <div className="absolute inset-1 rounded-xl border border-yellow-400/30 pointer-events-none" />

      {/* Grade 3x3 de células */}
      <div className="relative grid grid-cols-3 grid-rows-3 size-full gap-1.5 z-10">
        {grid.map((symbolId, idx) => {
          const col = idx % 3;
          const isColSpinning = isSpinning && !respinActive && col >= stoppedColumns;
          const isLocked = lockedIndices.has(idx);
          const isWinning = winningIndices.has(idx);
          const isDimmed = hasWins && !isWinning;

          return (
            <div
              key={idx}
              className={`relative rounded-xl overflow-hidden border border-amber-900/60 bg-gradient-to-b from-[#2a0408] to-[#140003] flex items-center justify-center transition-all duration-300 ${
                isWinning
                  ? "ring-2 ring-yellow-400 bg-amber-500/20 shadow-[0_0_16px_rgba(250,204,21,0.5)] z-20 scale-[1.02]"
                  : isDimmed
                  ? "opacity-35 grayscale-[40%]"
                  : ""
              } ${isLocked ? "ring-2 ring-yellow-300/80 bg-yellow-950/40" : ""}`}
            >
              {/* Efeito de desfoque/rotação contínua quando a coluna está girando */}
              {isColSpinning ? (
                <div className="absolute inset-0 flex flex-col items-center justify-around py-1 animate-pulse">
                  <div className="size-8 rounded-full bg-yellow-400/20 blur-sm" />
                  <div className="size-10 rounded-full bg-amber-500/25 blur-md" />
                  <div className="size-8 rounded-full bg-red-500/20 blur-sm" />
                </div>
              ) : (
                <GoldenTigerSymbol
                  id={symbolId}
                  isWinning={isWinning}
                  isLocked={isLocked}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Linhas de pagamento conectadas brilhantes (Laser Paylines) */}
      {hasWins && activeLines.length > 0 && (
        <svg
          className="absolute inset-2.5 size-[calc(100%-20px)] pointer-events-none z-30"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {activeLines.map((line, lIdx) => {
            const [p0, p1, p2] = line.positions;
            const c0 = CELL_CENTERS[p0];
            const c1 = CELL_CENTERS[p1];
            const c2 = CELL_CENTERS[p2];
            if (!c0 || !c1 || !c2) return null;

            return (
              <g key={lIdx} className="animate-pulse">
                {/* Linha externa brilhante */}
                <polyline
                  points={`${c0.x.replace('%','')},${c0.y.replace('%','')} ${c1.x.replace('%','')},${c1.y.replace('%','')} ${c2.x.replace('%','')},${c2.y.replace('%','')}`}
                  fill="none"
                  stroke="#ffd700"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                  filter="drop-shadow(0 0 4px #ff0055)"
                />
                {/* Núcleo de laser branco intenso */}
                <polyline
                  points={`${c0.x.replace('%','')},${c0.y.replace('%','')} ${c1.x.replace('%','')},${c1.y.replace('%','')} ${c2.x.replace('%','')},${c2.y.replace('%','')}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
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
