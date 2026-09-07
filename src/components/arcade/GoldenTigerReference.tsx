import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { formatCoins } from "@/lib/arcade/format";
import {
  BET_STEPS,
  type GoldenTigerSymbolId,
  type GoldenTigerWinTier,
} from "@/lib/arcade/golden-tiger/goldenTigerConfig";
import {
  playGoldenTigerRound,
  type GoldenTigerRoundPlan,
} from "@/lib/arcade/golden-tiger/goldenTigerEngine";
import type { LineWin } from "@/lib/arcade/golden-tiger/goldenTigerMath";
import { goldenTigerAudio } from "@/lib/arcade/golden-tiger/goldenTigerAudio";
import {
  GoldenTigerTigerStage,
  type TigerReactionState,
} from "./golden-tiger/GoldenTigerTigerStage";
import { GoldenTigerReelGrid } from "./golden-tiger/GoldenTigerReelGrid";
import { GoldenTigerHUD } from "./golden-tiger/GoldenTigerHUD";
import { GoldenTigerWinOverlay } from "./golden-tiger/GoldenTigerWinOverlay";

const INITIAL_GRID: GoldenTigerSymbolId[] = [
  "ingot", "orange", "jade",
  "bag", "wild", "firecracker",
  "lantern", "orange", "ingot",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  // Estados de configuração e aposta
  const [bet, setBet] = useState<number>(200);
  const [turbo, setTurbo] = useState(false);

  // Estados de apresentação e matriz
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [isSpinning, setIsSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(() => new Set());
  const [winningIndices, setWinningIndices] = useState<Set<number>>(() => new Set());
  const [activeLines, setActiveLines] = useState<readonly LineWin[]>([]);
  const [respinActive, setRespinActive] = useState(false);

  // Estados de vitória e mascote
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [isFullGrid, setIsFullGrid] = useState(false);
  const [tigerReaction, setTigerReaction] = useState<TigerReactionState>("idle");
  const [showWinOverlay, setShowWinOverlay] = useState(false);

  // Estados de auto play
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRounds, setAutoRounds] = useState(10);
  const autoStopRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  /** Executa uma rodada completa de giro e apresentação */
  const runSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;

    // Débito atômico único com verificação de saldo fictício
    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      goldenTigerAudio.buttonClick(soundEnabled);
      return false;
    }

    // 1. Reset da rodada anterior
    setIsSpinning(true);
    setStoppedColumns(0);
    setWinningIndices(new Set());
    setActiveLines([]);
    setLockedIndices(new Set());
    setRespinActive(false);
    setWin(0);
    setWinTier("none");
    setIsFullGrid(false);
    setShowWinOverlay(false);
    setTigerReaction("spin_watch");

    // Início de giro e áudio
    goldenTigerAudio.spinStart(soundEnabled);

    // 2. Determinação matemática pura do round (100% determinístico)
    const plan: GoldenTigerRoundPlan = playGoldenTigerRound(bet, Math.random);

    // 3. Animação de rotação contínua dos rolos
    await wait(turbo ? 160 : 420);

    // Parada escalonada das 3 colunas
    for (let col = 0; col < 3; col++) {
      setStoppedColumns(col + 1);
      goldenTigerAudio.reelLanding(col, soundEnabled);
      await wait(turbo ? 70 : 150);
    }

    // 4. Se a rodada tiver o recurso Lucky Tiger Respin:
    if (plan.isRespin && plan.respinSteps.length > 0) {
      setRespinActive(true);
      setTigerReaction("anticipation");
      goldenTigerAudio.respinTrigger(soundEnabled);

      // Trava os símbolos iniciais
      setGrid(plan.initialGrid);
      setLockedIndices(new Set(plan.initialLocked));
      await wait(turbo ? 300 : 650);

      // Executa visualmente cada passo do respin
      for (let sIdx = 0; sIdx < plan.respinSteps.length; sIdx++) {
        const step = plan.respinSteps[sIdx];
        if (!step) continue;

        setTigerReaction("spin_watch");
        goldenTigerAudio.spinStart(soundEnabled);
        await wait(turbo ? 140 : 340);

        setGrid(step.grid);
        setLockedIndices(new Set(step.lockedIndices));

        if (step.hasNewLocked) {
          setTigerReaction("lock");
          goldenTigerAudio.symbolLock(soundEnabled);
          await wait(turbo ? 160 : 380);
        } else {
          setTigerReaction("loss");
          goldenTigerAudio.respinMiss(soundEnabled);
          await wait(turbo ? 100 : 250);
        }
      }
    } else {
      setGrid(plan.finalGrid);
    }

    // 5. Avaliação final e impactos
    const { evaluation } = plan;
    setWinningIndices(evaluation.winningIndices);
    setActiveLines(evaluation.lines);
    setWinTier(evaluation.tier);
    setIsFullGrid(evaluation.isFullGrid);

    // Crédito atômico único se houver ganho
    if (evaluation.payout > 0) {
      arcadeActions.credit(evaluation.payout);
    }

    // Registro no histórico da conta
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet,
      payout: evaluation.payout,
      multiplier: evaluation.multiplier,
      note: `3×3 · ${evaluation.lines.length} linha(s)${plan.isRespin ? " · Tigre da Sorte" : ""}${evaluation.isFullGrid ? " · TELA CHEIA x10" : ""}`,
    });

    // 6. Apresentação comemorativa
    if (evaluation.payout > 0) {
      const duration = evaluation.tier === "small" ? 350 : evaluation.tier === "nice" ? 700 : 1200;
      setWin(evaluation.payout);
      setWinDuration(duration);

      if (evaluation.isFullGrid) {
        setTigerReaction("full_grid");
        goldenTigerAudio.fullGrid(soundEnabled);
        setShowWinOverlay(true);
      } else if (evaluation.tier === "big" || evaluation.tier === "mega" || evaluation.tier === "epic") {
        setTigerReaction("big_win");
        goldenTigerAudio.win(evaluation.tier, soundEnabled);
        setShowWinOverlay(true);
      } else {
        setTigerReaction("small_win");
        goldenTigerAudio.win(evaluation.tier, soundEnabled);
      }

      await wait(turbo ? 300 : duration + 200);
    } else {
      setTigerReaction("loss");
      setWin(0);
      setWinDuration(0);
      await wait(turbo ? 120 : 250);
    }

    setTigerReaction("idle");
    setIsSpinning(false);
    busyRef.current = false;
    return true;
  }, [bet, soundEnabled, turbo]);

  /** Loop de Auto Play */
  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    setAutoOpen(false);

    for (let left = autoRounds; left > 0; left--) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const ok = await runSpin();
      if (!ok) break;
      await wait(turbo ? 150 : 350);
    }
    setAutoLeft(0);
  }, [autoLeft, autoRounds, runSpin, turbo]);

  const changeBet = (delta: -1 | 1) => {
    if (isSpinning || autoLeft > 0) return;
    const currentIdx = Math.max(0, BET_STEPS.findIndex((v) => v === bet));
    const nextIdx = Math.max(0, Math.min(BET_STEPS.length - 1, currentIdx + delta));
    const nextBet = BET_STEPS[nextIdx];
    if (nextBet !== undefined) {
      setBet(nextBet);
      goldenTigerAudio.buttonClick(soundEnabled);
    }
  };

  const isInsufficient = bet > balance;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black flex flex-col justify-center items-center py-1 sm:py-3 px-2">
      {/* Contêiner Mobile Portrait de Alta Fidelidade (Máx 430px) */}
      <div className="relative w-full max-w-[430px] rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-[#240003] via-[#120002] to-[#240003] shadow-[0_0_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col justify-between py-3 px-2.5">
        {/* Barra Superior de Navegação e Mute */}
        <div className="flex items-center justify-between w-full px-2 z-40 mb-1">
          <Link
            to="/"
            className="size-9 rounded-full bg-black/60 border border-yellow-500/40 flex items-center justify-center text-yellow-200 hover:bg-yellow-500/20 active:scale-95 transition-transform"
            aria-label="Voltar ao Lobby"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="text-center">
            <span className="text-[8px] font-black tracking-[0.25em] text-yellow-400/80 uppercase block">
              NEON FORTUNE
            </span>
            <h1 className="text-xs font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-400">
              GOLDEN TIGER
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              arcadeActions.toggleSound();
              goldenTigerAudio.buttonClick(!soundEnabled);
            }}
            className="size-9 rounded-full bg-black/60 border border-yellow-500/40 flex items-center justify-center text-yellow-200 hover:bg-yellow-500/20 active:scale-95 transition-transform"
            aria-label={soundEnabled ? "Desativar áudio" : "Ativar áudio"}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>

        {/* Zona 1: Mascote Tigre Reativo */}
        <GoldenTigerTigerStage
          reaction={tigerReaction}
          respinActive={respinActive}
          lockedCount={lockedIndices.size}
        />

        {/* Zona 2: Gabinete 3x3 com Rolos Contínuos e Linhas Conectadas */}
        <div className="my-2">
          <GoldenTigerReelGrid
            grid={grid}
            isSpinning={isSpinning}
            respinActive={respinActive}
            lockedIndices={lockedIndices}
            winningIndices={winningIndices}
            activeLines={activeLines}
            stoppedColumns={stoppedColumns}
          />
        </div>

        {/* Zona 3: HUD Ergonômico de Controle */}
        <GoldenTigerHUD
          balance={balance}
          bet={bet}
          win={win}
          winDuration={winDuration}
          isSpinning={isSpinning}
          isTurbo={turbo}
          autoLeft={autoLeft}
          onSpin={() => void runSpin()}
          onToggleTurbo={() => setTurbo((v) => !v)}
          onOpenAuto={() => setAutoOpen(true)}
          onStopAuto={() => {
            autoStopRef.current = true;
          }}
          onChangeBet={changeBet}
        />

        {/* Modal de Configuração de Auto Play */}
        {autoOpen && (
          <div
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-[380px] p-5 rounded-3xl border-2 border-yellow-400 bg-gradient-to-b from-[#3b0409] to-[#120003] text-center shadow-2xl animate-scale-in">
              <h3 className="text-sm font-black tracking-widest text-amber-300 uppercase">
                AUTO PLAY · GOLDEN TIGER
              </h3>
              <p className="text-xs text-yellow-100/80 mt-1">
                {formatCoins(bet)} Moedas por rodada
              </p>

              <div className="grid grid-cols-4 gap-2 my-4">
                {[10, 25, 50, 100].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => setAutoRounds(rounds)}
                    className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                      autoRounds === rounds
                        ? "border-yellow-200 bg-gradient-to-b from-yellow-400 to-amber-600 text-stone-950 shadow-[0_0_10px_#f59e0b]"
                        : "border-yellow-500/30 bg-black/40 text-yellow-200 hover:bg-yellow-500/20"
                    }`}
                  >
                    {rounds}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setAutoOpen(false)}
                  className="py-2.5 rounded-xl border border-yellow-500/40 text-xs font-black text-yellow-200 hover:bg-yellow-500/10"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={() => void startAuto()}
                  className="py-2.5 rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-500 text-xs font-black text-stone-950 shadow-md active:scale-95"
                >
                  INICIAR {autoRounds}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay Comemorativo de Grandes Vitórias */}
        {showWinOverlay && (
          <GoldenTigerWinOverlay
            tier={winTier}
            isFullGrid={isFullGrid}
            payout={win}
            duration={winDuration}
            onDismiss={() => setShowWinOverlay(false)}
          />
        )}

        {/* Alerta de Saldo Insuficiente */}
        {isInsufficient && (
          <div className="absolute inset-x-4 bottom-3 z-40 py-2 px-3 rounded-xl border border-red-400 bg-red-950/95 text-center text-xs font-black text-red-200 shadow-lg">
            Saldo fictício insuficiente — recarregue moedas no lobby!
          </div>
        )}
      </div>
    </main>
  );
}
