import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GOLDEN_TIGER_PAYLINES,
  GOLDEN_TIGER_SYMBOLS,
  SYMBOL_ORDER,
  type GoldenTigerSymbolId,
} from "./goldenTigerConfig";
import {
  evaluateGrid,
  evaluateLine,
  generateGrid,
  pickRespinTarget,
} from "./goldenTigerMath";
import { playGoldenTigerRound } from "./goldenTigerEngine";

describe("Golden Tiger — Pure Math & Config", () => {
  it("tem 5 linhas de pagamento válidas mapeando a grade 3x3", () => {
    assert.equal(GOLDEN_TIGER_PAYLINES.length, 5);
    for (const line of GOLDEN_TIGER_PAYLINES) {
      assert.equal(line.length, 3);
      for (const pos of line) {
        assert.ok(pos >= 0 && pos <= 8, `Posição fora dos limites 3x3: ${pos}`);
      }
    }
  });

  it("gera grades válidas de 9 posições com símbolos conhecidos", () => {
    const grid = generateGrid("base", Math.random);
    assert.equal(grid.length, 9);
    for (const sym of grid) {
      assert.ok(SYMBOL_ORDER.includes(sym), `Símbolo desconhecido: ${sym}`);
    }
  });

  it("avalia linha pura de 3 Wilds com o pagamento máximo de 45x aposta total", () => {
    const grid: GoldenTigerSymbolId[] = [
      "wild", "wild", "wild",
      "orange", "orange", "lantern",
      "bag", "jade", "firecracker",
    ];
    const bet = 100;
    // Linha 2 é [0, 1, 2]
    const win = evaluateLine([0, 1, 2], grid, bet, 1);
    assert.ok(win !== null);
    assert.equal(win.symbol, "wild");
    assert.equal(win.multiplier, 45);
    assert.equal(win.payout, bet * 45); // 100 * 45 = 4500
  });

  it("substitui Wild em combinação com símbolo regular", () => {
    const grid: GoldenTigerSymbolId[] = [
      "ingot", "wild", "ingot",
      "orange", "orange", "lantern",
      "bag", "jade", "firecracker",
    ];
    const bet = 100;
    const win = evaluateLine([0, 1, 2], grid, bet, 1);
    assert.ok(win !== null);
    assert.equal(win.symbol, "ingot");
    assert.equal(win.multiplier, GOLDEN_TIGER_SYMBOLS.ingot.symbolMultiplier); // 18
    assert.equal(win.payout, bet * 18);
  });

  it("aplica multiplicador de Tela Cheia x10 quando todas as 9 células fecham o símbolo", () => {
    const fullIngots: GoldenTigerSymbolId[] = [
      "ingot", "ingot", "ingot",
      "ingot", "ingot", "ingot",
      "ingot", "ingot", "ingot",
    ];
    const bet = 100;
    const evalResult = evaluateGrid(fullIngots, bet);

    assert.equal(evalResult.isFullGrid, true);
    assert.equal(evalResult.multiplier, 10);
    assert.equal(evalResult.lines.length, 5);
    // 5 linhas * (100 * 18) = 5 * 1800 = 9.000 base * 10x = 90.000
    assert.equal(evalResult.basePayout, 9_000);
    assert.equal(evalResult.payout, 90_000);
    assert.equal(evalResult.tier, "epic");
  });

  it("reconhece Tela Cheia x10 quando a primeira célula é Wild e as demais são regulares", () => {
    const fullGridWithWild: GoldenTigerSymbolId[] = [
      "wild", "orange", "orange",
      "orange", "wild", "orange",
      "orange", "orange", "orange",
    ];
    const bet = 100;
    const evalResult = evaluateGrid(fullGridWithWild, bet);

    assert.equal(evalResult.isFullGrid, true);
    assert.equal(evalResult.multiplier, 10);
    assert.equal(evalResult.winningIndices.size, 9);
    assert.ok(evalResult.payout > evalResult.basePayout);
  });

  it("NÃO aplica Tela Cheia x10 se houver um símbolo dissonante", () => {
    const almostFull: GoldenTigerSymbolId[] = [
      "ingot", "ingot", "ingot",
      "ingot", "ingot", "ingot",
      "ingot", "ingot", "orange", // 1 laranja quebra a tela cheia
    ];
    const bet = 100;
    const evalResult = evaluateGrid(almostFull, bet);

    assert.equal(evalResult.isFullGrid, false);
    assert.equal(evalResult.multiplier, 1);
  });

  it("o alvo do Lucky Tiger Respin NUNCA é Wild", () => {
    for (let i = 0; i < 50; i++) {
      const grid = generateGrid("base", Math.random);
      const target = pickRespinTarget(grid, Math.random);
      assert.notEqual(target, "wild");
    }
  });
});

describe("Golden Tiger — Deterministic Round Engine", () => {
  it("gera rodada base sem respin e calcula payout determinístico", () => {
    const round = playGoldenTigerRound(100, Math.random, false);
    assert.equal(round.isRespin, false);
    assert.equal(round.targetSymbol, null);
    assert.equal(round.respinSteps.length, 0);
    assert.equal(round.finalGrid.length, 9);
    assert.ok(Number.isFinite(round.evaluation.payout));
    assert.ok(round.evaluation.payout >= 0);
  });

  it("gera rodada com Lucky Tiger Respin preservando símbolos travados", () => {
    const round = playGoldenTigerRound(100, Math.random, true);
    assert.equal(round.isRespin, true);
    assert.ok(round.targetSymbol !== null);
    assert.notEqual(round.targetSymbol, "wild");

    // Verifica se os símbolos inicialmente travados permaneceram nos passos subsequentes
    for (const step of round.respinSteps) {
      for (const lockedIndex of round.initialLocked) {
        assert.ok(
          step.lockedIndices.has(lockedIndex),
          `Célula ${lockedIndex} foi destravada indevidamente no respin`,
        );
      }
    }
  });

  it("simulação de 25.000 rodadas mantém RTP saudável, sem NaN e sem pagamentos negativos", () => {
    const roundsCount = 25_000;
    const bet = 100;
    let totalBet = 0;
    let totalWon = 0;
    let hits = 0;
    let respinTriggers = 0;
    let fullGrids = 0;

    for (let i = 0; i < roundsCount; i++) {
      totalBet += bet;
      const round = playGoldenTigerRound(bet, Math.random);

      assert.ok(!Number.isNaN(round.evaluation.payout), "Payout não pode ser NaN");
      assert.ok(round.evaluation.payout >= 0, "Payout não pode ser negativo");

      totalWon += round.evaluation.payout;
      if (round.evaluation.payout > 0) hits++;
      if (round.isRespin) respinTriggers++;
      if (round.evaluation.isFullGrid) fullGrids++;
    }

    const rtp = (totalWon / totalBet) * 100;
    const hitRate = (hits / roundsCount) * 100;
    const respinRate = (respinTriggers / roundsCount) * 100;

    // RTP alvo comercial típico fica entre 92% e 99%
    assert.ok(
      rtp >= 90 && rtp <= 102,
      `RTP fora da faixa aceitável na simulação: ${rtp.toFixed(2)}%`,
    );
    // Hit rate saudável entre 15% e 30%
    assert.ok(
      hitRate >= 14 && hitRate <= 32,
      `Hit rate fora da faixa aceitável: ${hitRate.toFixed(2)}%`,
    );

    // Registra métricas no console do teste para auditoria
    console.log(
      `[Golden Tiger Monte Carlo] Rodadas: ${roundsCount} | RTP: ${rtp.toFixed(2)}% | Hit Rate: ${hitRate.toFixed(2)}% | Respins: ${respinRate.toFixed(2)}% (${respinTriggers}) | Full Grids: ${fullGrids}`,
    );
  });
});
