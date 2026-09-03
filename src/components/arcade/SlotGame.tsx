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
import { SlotSymbolArt } from "./SlotSymbolArt";
import { TigerCubMascot } from "./GameArtwork";

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
      if (lastWinning) for (const win of lastWinning.wins) for (const [row, col] of win.cells) cells.add(`${row}:${col}`);
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

    const nextResult = spin(config, bet, createRng());
    if (nextResult.kind === "cluster") {
      for (const step of nextResult.steps) {
        setGrid(step.grid);
        playSound("tick", soundEnabled);
        await delay(185);
      }
      setGrid(nextResult.finalGrid);
    } else {
      await delay(680);
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
    playSound(nextResult.payout >= bet * 10 ? "bigWin" : nextResult.payout > 0 ? "win" : "lose", soundEnabled);
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
  const theme = config.slug === "golden-tiger" ? "tiger" : config.slug === "olympus-storm" ? "storm" : "candy";

  return (
    <div className={cn("slot-machine", `slot-machine--${theme}`)}>
      <section className="slot-machine__cabinet">
        <div className="slot-machine__masthead">
          {theme === "tiger" && <TigerCubMascot className="slot-machine__mascot" />}
          <div className="slot-machine__brand">
            <small>{theme === "tiger" ? "GOLDEN PRIVATE ARCADE" : theme === "storm" ? "TEMPLE OF LIGHTNING" : "SUGAR KINGDOM"}</small>
            <h2>{config.name}</h2>
            <span>{config.mode === "lines" ? "5 LINHAS FIXAS" : "CASCATAS & MULTIPLICADORES"}</span>
          </div>
          <div className="slot-machine__jackpot">
            <small>{theme === "candy" ? "SUGAR JACKPOT" : "GRAND JACKPOT"}</small>
            <strong>1.250.000</strong>
          </div>
        </div>

        <div className="slot-machine__reel-frame">
          <div
            className={cn("slot-grid", spinning && "slot-grid--spinning")}
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
                    className={cn("slot-cell", won && "slot-cell--win", spinning && "slot-cell--spinning")}
                    title={symbol.label}
                  >
                    <SlotSymbolArt game={config.slug} symbolId={symbolId} />
                    <span className="sr-only">{symbol.label}</span>
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="slot-win-panel" role="status" aria-live="polite">
          <small>WIN</small>
          <strong>{formatCoins(payout)}</strong>
          <span>{result ? formatMultiplier(multiplier) : freeSpins > 0 ? `${freeSpins} giros grátis` : "Boa sorte"}</span>
        </div>

        <div className="slot-machine__controls">
          <div className="slot-machine__bet"><BetControls value={bet} onChange={setBet} disabled={spinning || autoLeft > 0 || freeSpins > 0} /></div>
          <div className="slot-machine__action-row">
            {autoLeft > 0 ? (
              <Button size="lg" variant="destructive" className="slot-side-button" onClick={() => { stopAuto.current = true; }}>
                <Pause className="size-5" aria-hidden /> Parar {autoLeft}
              </Button>
            ) : (
              <Button size="lg" variant="secondary" className="slot-side-button" disabled={spinning || insufficient} onClick={() => void startAuto()}>
                <Play className="size-5" aria-hidden /> Auto 10
              </Button>
            )}

            <Button
              size="lg"
              variant="gold"
              className="slot-spin-button"
              disabled={spinning || autoLeft > 0 || insufficient}
              onClick={() => void performSpin()}
              aria-label={freeSpins > 0 ? "Usar giro grátis" : "Girar rolos"}
            >
              <RotateCw className={cn("size-8", spinning && "animate-spin")} aria-hidden />
              <span>{freeSpins > 0 ? "FREE" : "SPIN"}</span>
            </Button>

            <PaytableModal config={config} />
          </div>
          {insufficient && <p className="slot-machine__warning" role="alert">Saldo insuficiente. Recarregue moedas fictícias no topo.</p>}
        </div>
      </section>

      <section className="slot-machine__info">
        <p className="flex items-center gap-1 font-bold uppercase tracking-wider text-primary"><Sparkles className="size-4" aria-hidden /> Como funciona</p>
        <p>{config.paytableNote}</p>
        {config.mode === "cluster" && <p className="mt-2 flex items-center gap-1 text-jade"><Zap className="size-4" aria-hidden /> Cada vitória pode disparar outra cascata.</p>}
        <p className="mt-2 text-[0.7rem] uppercase tracking-wider text-white/35">Simulação fictícia — sem valor real</p>
      </section>
    </div>
  );
}
