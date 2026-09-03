import { Pause, Play, RotateCw, Sparkles, Zap } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { createRng } from "@/lib/arcade/rng";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import {
  randomGrid,
  spin,
  symbolById,
  type Grid,
  type SlotConfig,
  type SpinResult,
} from "@/lib/arcade/slot-engine";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { BetControls } from "./BetControls";
import { PaytableModal } from "./PaytableModal";
import { WinOverlay } from "./WinOverlay";

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function SlotGame({ config }: { config: SlotConfig }) {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(BET_STEPS[2]);
  const [grid, setGrid] = useState<Grid>(() => randomGrid(config, () => 0.42));
  const [result, setResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const stopAuto = useRef(false);
  const freeSpinsRef = useRef(0);
  const busyRef = useRef(false);

  const winningCells = useMemo(() => {
    const cells = new Set<string>();
    if (!result) return cells;
    if (result.kind === "lines") {
      for (const win of result.wins) for (const [row, col] of win.cells) cells.add(`${row}:${col}`);
    } else {
      const lastWinning = [...result.steps].reverse().find((step) => step.wins.length > 0);
      if (lastWinning) {
        for (const win of lastWinning.wins) {
          for (const [row, col] of win.cells) cells.add(`${row}:${col}`);
        }
      }
    }
    return cells;
  }, [result]);

  const performSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    const usingFreeSpin = freeSpinsRef.current > 0;
    if (usingFreeSpin) {
      freeSpinsRef.current -= 1;
      setFreeSpins(freeSpinsRef.current);
    } else if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setSpinning(true);
    setResult(null);
    playSound("spin", soundEnabled);

    // The complete outcome is generated now; the following delays only reveal it.
    const nextResult = spin(config, bet, createRng());
    if (nextResult.kind === "cluster") {
      for (const step of nextResult.steps) {
        setGrid(step.grid);
        await delay(180);
      }
      setGrid(nextResult.finalGrid);
    } else {
      await delay(650);
      setGrid(nextResult.grid);
    }

    if (nextResult.payout > 0) arcadeActions.credit(nextResult.payout);
    arcadeActions.recordRound({
      slug: config.slug,
      gameName: config.name,
      bet,
      payout: nextResult.payout,
      multiplier: nextResult.totalMultiplier,
      note: usingFreeSpin ? "Giro grátis" : config.mode === "cluster" ? "Cascata" : "5 linhas",
    });

    if (nextResult.kind === "lines" && nextResult.freeSpinsAwarded > 0) {
      freeSpinsRef.current += nextResult.freeSpinsAwarded;
      setFreeSpins(freeSpinsRef.current);
    }

    setResult(nextResult);
    setSpinning(false);
    busyRef.current = false;
    playSound(
      nextResult.payout >= bet * 10 ? "bigWin" : nextResult.payout > 0 ? "win" : "lose",
      soundEnabled,
    );
    return true;
  }, [bet, config, soundEnabled]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    stopAuto.current = false;
    for (let remaining = 10; remaining > 0; remaining--) {
      if (stopAuto.current) break;
      setAutoLeft(remaining);
      const played = await performSpin();
      if (!played) break;
      await delay(420);
    }
    setAutoLeft(0);
  }, [autoLeft, performSpin]);

  const insufficient = freeSpins === 0 && bet > balance;
  const multiplier = result?.totalMultiplier ?? 0;
  const payout = result?.payout ?? 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-ink/80 p-3 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {config.mode === "lines" ? "5 linhas fixas" : "Clusters e cascatas"}
            </p>
            <p className="font-display text-sm font-bold text-primary">
              {freeSpins > 0 ? `${freeSpins} giros grátis` : "Simulação fictícia"}
            </p>
          </div>
          {result && (
            <div className="text-right">
              <p className="text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                Último ganho
              </p>
              <p className="font-display font-bold tabular-nums text-jade">
                {formatCoins(payout)} · {formatMultiplier(multiplier)}
              </p>
            </div>
          )}
        </div>

        <div
          className={cn(
            "relative grid overflow-hidden rounded-2xl border border-primary/20 bg-background/65 p-2 sm:p-3",
            spinning && "opacity-90",
          )}
          style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
          aria-label={`Grade de ${config.cols} por ${config.rows}`}
        >
          {grid.flatMap((row, rowIndex) =>
            row.map((symbolId, colIndex) => {
              const symbol = symbolById(config, symbolId);
              const won = winningCells.has(`${rowIndex}:${colIndex}`);
              return (
                <div
                  key={`${rowIndex}:${colIndex}`}
                  className={cn(
                    "m-0.5 flex aspect-square min-w-0 items-center justify-center rounded-lg border border-border/50 bg-ink-soft/80 text-xl shadow-inner sm:m-1 sm:rounded-xl sm:text-3xl",
                    won &&
                      "border-primary motion-safe:animate-[win-pulse_900ms_ease-in-out_infinite]",
                    spinning && "motion-safe:animate-[symbol-drop_260ms_ease-out]",
                  )}
                  title={symbol.label}
                >
                  <span className="drop-shadow-lg" aria-hidden>
                    {symbol.glyph}
                  </span>
                  <span className="sr-only">{symbol.label}</span>
                </div>
              );
            }),
          )}
        </div>
        {!spinning && result && <WinOverlay payout={payout} multiplier={multiplier} />}
      </section>

      <aside className="grid content-start gap-3">
        <BetControls
          value={bet}
          onChange={setBet}
          disabled={spinning || autoLeft > 0 || freeSpins > 0}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant="gold"
            className="min-h-14 rounded-2xl text-base font-black"
            disabled={spinning || autoLeft > 0 || insufficient}
            onClick={() => void performSpin()}
          >
            <RotateCw className={cn("size-5", spinning && "animate-spin")} aria-hidden />
            {freeSpins > 0 ? "Giro grátis" : "Girar"}
          </Button>
          {autoLeft > 0 ? (
            <Button
              size="lg"
              variant="destructive"
              className="min-h-14 rounded-2xl"
              onClick={() => {
                stopAuto.current = true;
              }}
            >
              <Pause className="size-5" aria-hidden /> Parar {autoLeft}
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              className="min-h-14 rounded-2xl"
              disabled={spinning || insufficient}
              onClick={() => void startAuto()}
            >
              <Play className="size-5" aria-hidden /> Auto 10
            </Button>
          )}
        </div>
        {insufficient && (
          <p
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive-foreground"
            role="alert"
          >
            Saldo insuficiente. Recarregue moedas grátis no topo.
          </p>
        )}
        <PaytableModal config={config} />
        <div className="rounded-2xl border border-border/70 bg-ink/60 p-3 text-xs text-muted-foreground">
          <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-primary">
            <Sparkles className="size-4" aria-hidden /> Como funciona
          </p>
          <p>{config.paytableNote}</p>
          {config.mode === "cluster" && (
            <p className="mt-2 flex items-center gap-1 text-jade">
              <Zap className="size-4" aria-hidden /> Cada vitória pode iniciar outra cascata.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
