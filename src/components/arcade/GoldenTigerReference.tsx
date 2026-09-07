import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatCoins } from "@/lib/arcade/format";
import { goldenTigerAudio } from "@/lib/arcade/golden-tiger/goldenTigerAudio";
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
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";

import { GoldenTigerHUD } from "./golden-tiger/GoldenTigerHUD";
import { GoldenTigerReelGrid } from "./golden-tiger/GoldenTigerReelGrid";
import {
  GoldenTigerTigerStage,
  type TigerReactionState,
} from "./golden-tiger/GoldenTigerTigerStage";
import { GoldenTigerWinOverlay } from "./golden-tiger/GoldenTigerWinOverlay";

const INITIAL_GRID: GoldenTigerSymbolId[] = [
  "ingot",
  "orange",
  "jade",
  "bag",
  "wild",
  "firecracker",
  "lantern",
  "orange",
  "ingot",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  const [bet, setBet] = useState<number>(200);
  const [turbo, setTurbo] = useState(false);

  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [isSpinning, setIsSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [lockedIndices, setLockedIndices] = useState<Set<number>>(() => new Set());
  const [winningIndices, setWinningIndices] = useState<Set<number>>(() => new Set());
  const [activeLines, setActiveLines] = useState<readonly LineWin[]>([]);
  const [respinActive, setRespinActive] = useState(false);
  const [respinRolling, setRespinRolling] = useState(false);

  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [isFullGrid, setIsFullGrid] = useState(false);
  const [tigerReaction, setTigerReaction] = useState<TigerReactionState>("idle");
  const [showWinOverlay, setShowWinOverlay] = useState(false);

  const [autoLeft, setAutoLeft] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRounds, setAutoRounds] = useState(10);
  const autoStopRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    hydrateFromStorage();

    return () => {
      // Never let Auto Play initiate another paid round after this game route
      // has been left. An already-started round is allowed to finish its
      // accounting so the wager can never disappear without a result.
      autoStopRef.current = true;
    };
  }, []);

  const runSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;

    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      goldenTigerAudio.buttonClick(soundEnabled);
      return false;
    }

    setIsSpinning(true);
    setStoppedColumns(0);
    setWinningIndices(new Set());
    setActiveLines([]);
    setLockedIndices(new Set());
    setRespinActive(false);
    setRespinRolling(false);
    setWin(0);
    setWinTier("none");
    setIsFullGrid(false);
    setShowWinOverlay(false);
    setTigerReaction("spin_watch");
    goldenTigerAudio.spinStart(soundEnabled);

    try {
      const plan: GoldenTigerRoundPlan = playGoldenTigerRound(bet, Math.random);

      // Keep the precomputed result underneath the moving strips from the first
      // frame. Each strip can then disappear at landing without swapping to a
      // different symbol afterward, eliminating the old reel-stop teleport.
      setGrid(plan.initialGrid);

      await wait(turbo ? 145 : 430);

      for (let column = 0; column < 3; column += 1) {
        setStoppedColumns(column + 1);
        goldenTigerAudio.reelLanding(column, soundEnabled);
        await wait(turbo ? 82 : 205);
      }

      if (plan.isRespin && plan.respinSteps.length > 0) {
        setRespinActive(true);
        setLockedIndices(new Set(plan.initialLocked));
        setTigerReaction("anticipation");
        goldenTigerAudio.respinTrigger(soundEnabled);
        await wait(turbo ? 260 : 560);

        for (const step of plan.respinSteps) {
          setTigerReaction("spin_watch");
          setRespinRolling(true);
          goldenTigerAudio.spinStart(soundEnabled);
          await wait(turbo ? 155 : 360);

          // The moving overlay still covers every unlocked cell while the
          // already-decided step is installed underneath it. Removing the
          // overlay and changing the lock state in the same presentation beat
          // makes the reveal continuous while locked cells never disappear.
          setGrid(step.grid);
          setLockedIndices(new Set(step.lockedIndices));
          setRespinRolling(false);

          if (step.hasNewLocked) {
            setTigerReaction("lock");
            goldenTigerAudio.symbolLock(soundEnabled);
            await wait(turbo ? 175 : 390);
          } else {
            setTigerReaction("loss");
            goldenTigerAudio.respinMiss(soundEnabled);
            await wait(turbo ? 110 : 245);
          }
        }
      }

      setGrid(plan.finalGrid);
      setRespinRolling(false);

      const { evaluation } = plan;
      setWinningIndices(evaluation.winningIndices);
      setActiveLines(evaluation.lines);
      setWinTier(evaluation.tier);
      setIsFullGrid(evaluation.isFullGrid);

      if (evaluation.payout > 0) arcadeActions.credit(evaluation.payout);

      arcadeActions.recordRound({
        slug: "golden-tiger",
        gameName: "Golden Tiger",
        bet,
        payout: evaluation.payout,
        multiplier: evaluation.multiplier,
        note: `3×3 · ${evaluation.lines.length} linha(s)${plan.isRespin ? " · Tigre da Sorte" : ""}${evaluation.isFullGrid ? " · TELA CHEIA x10" : ""}`,
      });

      if (evaluation.payout > 0) {
        const duration =
          evaluation.tier === "small" ? 350 : evaluation.tier === "nice" ? 700 : 1200;
        setWin(evaluation.payout);
        setWinDuration(duration);
        goldenTigerAudio.lineHit(soundEnabled);

        if (evaluation.isFullGrid) {
          setTigerReaction("full_grid");
          goldenTigerAudio.fullGrid(soundEnabled);
          setShowWinOverlay(true);
        } else if (
          evaluation.tier === "big" ||
          evaluation.tier === "mega" ||
          evaluation.tier === "epic"
        ) {
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
      return true;
    } finally {
      setRespinRolling(false);
      setIsSpinning(false);
      setStoppedColumns(3);
      busyRef.current = false;
    }
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    setAutoOpen(false);

    for (let left = autoRounds; left > 0; left -= 1) {
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
    const currentIndex = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const nextIndex = Math.max(0, Math.min(BET_STEPS.length - 1, currentIndex + delta));
    const nextBet = BET_STEPS[nextIndex];
    if (nextBet !== undefined) {
      setBet(nextBet);
      goldenTigerAudio.buttonClick(soundEnabled);
    }
  };

  const isInsufficient = bet > balance;
  const showInsufficient = isInsufficient && !isSpinning && autoLeft === 0;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black flex flex-col justify-center items-center py-1 sm:py-3 px-2">
      <div className="relative w-full max-w-[430px] rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-[#240003] via-[#120002] to-[#240003] shadow-[0_0_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col justify-between py-3 px-2.5">
        <div className="flex items-center justify-between w-full px-2 z-40 mb-1">
          <Link
            to="/"
            onClick={() => {
              autoStopRef.current = true;
            }}
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

        <GoldenTigerTigerStage
          reaction={tigerReaction}
          respinActive={respinActive}
          lockedCount={lockedIndices.size}
        />

        <div className="my-2">
          <GoldenTigerReelGrid
            grid={grid}
            isSpinning={isSpinning}
            isTurbo={turbo}
            respinActive={respinActive}
            respinRolling={respinRolling}
            lockedIndices={lockedIndices}
            winningIndices={winningIndices}
            activeLines={activeLines}
            stoppedColumns={stoppedColumns}
          />
        </div>

        <GoldenTigerHUD
          balance={balance}
          bet={bet}
          win={win}
          winDuration={winDuration}
          isSpinning={isSpinning}
          isTurbo={turbo}
          autoLeft={autoLeft}
          onSpin={() => void runSpin()}
          onToggleTurbo={() => setTurbo((value) => !value)}
          onOpenAuto={() => setAutoOpen(true)}
          onStopAuto={() => {
            autoStopRef.current = true;
          }}
          onChangeBet={changeBet}
        />

        {autoOpen && (
          <div
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar Auto Play"
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
                  disabled={isInsufficient}
                  className="py-2.5 rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-500 text-xs font-black text-stone-950 shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                >
                  INICIAR {autoRounds}
                </button>
              </div>
            </div>
          </div>
        )}

        {showWinOverlay && (
          <GoldenTigerWinOverlay
            tier={winTier}
            isFullGrid={isFullGrid}
            payout={win}
            duration={winDuration}
            onDismiss={() => setShowWinOverlay(false)}
          />
        )}

        {showInsufficient && (
          <div className="absolute inset-x-4 bottom-3 z-40 py-2 px-3 rounded-xl border border-red-400 bg-red-950/95 text-center text-xs font-black text-red-200 shadow-lg">
            Saldo fictício insuficiente — recarregue moedas no lobby!
          </div>
        )}
      </div>
    </main>
  );
}
