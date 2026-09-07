import {
  LUCKY_TIGER_CHANCE,
  type GoldenTigerSymbolId,
} from "./goldenTigerConfig";
import {
  evaluateGrid,
  executeRespinStep,
  generateGrid,
  pickRespinTarget,
  type RespinStepResult,
  type SpinEvaluation,
} from "./goldenTigerMath";

export interface GoldenTigerRoundPlan {
  isRespin: boolean;
  targetSymbol: Exclude<GoldenTigerSymbolId, "wild"> | null;
  initialGrid: GoldenTigerSymbolId[];
  initialLocked: Set<number>;
  respinSteps: RespinStepResult[];
  finalGrid: GoldenTigerSymbolId[];
  evaluation: SpinEvaluation;
}

/**
 * Executa uma rodada completa de Golden Tiger de forma 100% pura e determinística.
 * Pré-calcula todo o desenrolar (inclusive todas as etapas do Lucky Tiger Respin se ativado)
 * para que a apresentação gráfica apenas reproduza os passos já decididos pela matemática.
 */
export function playGoldenTigerRound(
  bet: number,
  rng: () => number = Math.random,
  forceRespin?: boolean,
): GoldenTigerRoundPlan {
  const isRespin = forceRespin !== undefined ? forceRespin : rng() < LUCKY_TIGER_CHANCE;
  const initialGrid = generateGrid("base", rng);

  if (!isRespin) {
    const evaluation = evaluateGrid(initialGrid, bet);
    return {
      isRespin: false,
      targetSymbol: null,
      initialGrid,
      initialLocked: new Set(),
      respinSteps: [],
      finalGrid: initialGrid,
      evaluation,
    };
  }

  // Modo Lucky Tiger Respin:
  const targetSymbol = pickRespinTarget(initialGrid, rng);
  const initialLocked = new Set<number>();

  initialGrid.forEach((sym, idx) => {
    if (sym === targetSymbol || sym === "wild") {
      initialLocked.add(idx);
    }
  });

  const respinSteps: RespinStepResult[] = [];
  let currentGrid = [...initialGrid];
  let currentLocked = new Set(initialLocked);

  // Executa os giros adicionais enquanto novos símbolos continuarem caindo e a grade não encher
  let continueSpinning = true;
  let safetyCounter = 0;

  while (continueSpinning && currentLocked.size < 9 && safetyCounter < 15) {
    safetyCounter++;
    const step = executeRespinStep(currentGrid, targetSymbol, currentLocked, rng);
    respinSteps.push(step);
    currentGrid = step.grid;
    currentLocked = step.lockedIndices;

    // Continua apenas se ao menos 1 novo símbolo foi travado
    if (!step.hasNewLocked || step.isFull) {
      continueSpinning = false;
    }
  }

  const finalGrid = currentGrid;
  const evaluation = evaluateGrid(finalGrid, bet);

  return {
    isRespin: true,
    targetSymbol,
    initialGrid,
    initialLocked,
    respinSteps,
    finalGrid,
    evaluation,
  };
}
