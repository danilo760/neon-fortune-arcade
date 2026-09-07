import {
  MOTION_TIMINGS,
  SYMBOL_ORDER,
  type GoldenTigerSymbolId,
} from "./goldenTigerConfig";

export interface ColumnReelStrip {
  columnIndex: number;
  symbols: GoldenTigerSymbolId[]; // Da base (antiga) até o topo (alvo)
  targetIndexOffset: number;
  durationMs: number;
  delayMs: number;
}

/** Gera uma sequência de símbolos de passagem contínua para uma coluna */
export function buildContinuousStrip(
  currentColumnSymbols: readonly [GoldenTigerSymbolId, GoldenTigerSymbolId, GoldenTigerSymbolId],
  targetColumnSymbols: readonly [GoldenTigerSymbolId, GoldenTigerSymbolId, GoldenTigerSymbolId],
  columnIndex: number,
  isTurbo: boolean,
  rng: () => number = Math.random,
): ColumnReelStrip {
  const passingCount = isTurbo ? 6 : 10 + columnIndex * 2;
  const passingSymbols: GoldenTigerSymbolId[] = [];

  for (let i = 0; i < passingCount; i++) {
    const symIndex = Math.floor(rng() * SYMBOL_ORDER.length);
    const sym = SYMBOL_ORDER[symIndex] ?? "orange";
    passingSymbols.push(sym);
  }

  // A fita é construída na ordem física:
  // [Target 0, Target 1, Target 2] ... [Passing Symbols] ... [Current 0, Current 1, Current 2]
  // Conforme o rolo se desloca para baixo, os itens passam e o Target para exatamente na moldura visível.
  const fullStrip: GoldenTigerSymbolId[] = [
    targetColumnSymbols[0],
    targetColumnSymbols[1],
    targetColumnSymbols[2],
    ...passingSymbols,
    currentColumnSymbols[0],
    currentColumnSymbols[1],
    currentColumnSymbols[2],
  ];

  const timings = isTurbo ? MOTION_TIMINGS.turbo : MOTION_TIMINGS.normal;
  const baseDuration = timings.spinAcceleration + timings.spinCruise;
  const staggerDelay = columnIndex * timings.columnDecelStagger;
  const totalDuration = baseDuration + staggerDelay + timings.landingBounce;

  return {
    columnIndex,
    symbols: fullStrip,
    targetIndexOffset: 0,
    durationMs: totalDuration,
    delayMs: 0,
  };
}

/** Gera keyframes CSS precisos com física de antecipação, desaceleração e amortecimento elástico */
export function generateReelKeyframes(
  totalCellsCount: number,
  cellHeightPx: number,
  isTurbo: boolean,
): Keyframe[] {
  // A distância total percorrida é da base da fita até as 3 primeiras células (alvo)
  const targetDistancePx = (totalCellsCount - 3) * cellHeightPx;
  const pullbackPx = isTurbo ? 0 : -14;
  const overshootPx = targetDistancePx + (isTurbo ? 5 : 10);

  if (isTurbo) {
    return [
      { transform: "translate3d(0, 0px, 0)", offset: 0 },
      { transform: `translate3d(0, ${targetDistancePx * 0.4}px, 0)`, offset: 0.35 },
      { transform: `translate3d(0, ${overshootPx}px, 0)`, offset: 0.85 },
      { transform: `translate3d(0, ${targetDistancePx}px, 0)`, offset: 1.0 },
    ];
  }

  return [
    { transform: "translate3d(0, 0px, 0)", offset: 0, easing: "cubic-bezier(0.2, 0, 0.4, 1)" },
    { transform: `translate3d(0, ${pullbackPx}px, 0)`, offset: 0.08, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    { transform: `translate3d(0, ${targetDistancePx * 0.3}px, 0)`, offset: 0.32, easing: "linear" },
    { transform: `translate3d(0, ${targetDistancePx * 0.85}px, 0)`, offset: 0.72, easing: "cubic-bezier(0.1, 0.8, 0.3, 1)" },
    { transform: `translate3d(0, ${overshootPx}px, 0)`, offset: 0.9, easing: "cubic-bezier(0.3, 1.4, 0.6, 1)" },
    { transform: `translate3d(0, ${targetDistancePx}px, 0)`, offset: 1.0, easing: "ease-out" },
  ];
}
