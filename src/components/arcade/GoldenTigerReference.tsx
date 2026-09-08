import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatCoins } from "@/lib/arcade/format";
import {
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
  type GoldenTigerSymbolId,
} from "@/lib/arcade/goldenTigerMath";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";
import "./GoldenTigerReference.css";

const ART = "/golden-tiger/golden-tiger-2026.webp";
const BETS = [10, 20, 50, 100, 200, 500, 1_000] as const;
const INITIAL: GoldenTigerSymbolId[] = [
  "fortuneBag",
  "scatter",
  "jade",
  "orange",
  "wild",
  "firecracker",
  "jade",
  "lantern",
  "fortuneBag",
];
const STRIP: GoldenTigerSymbolId[] = [
  "fortuneBag",
  "scatter",
  "jade",
  "orange",
  "wild",
  "firecracker",
  "jade",
  "lantern",
  "ingot",
];
const CROPS: Record<GoldenTigerSymbolId, { x: number; y: number }> = {
  fortuneBag: { x: 72, y: 438 },
  scatter: { x: 339, y: 438 },
  jade: { x: 606, y: 438 },
  orange: { x: 72, y: 677 },
  wild: { x: 339, y: 677 },
  firecracker: { x: 606, y: 677 },
  lantern: { x: 339, y: 916 },
  ingot: { x: 72, y: 438 },
  lion: { x: 339, y: 677 },
};
type Phase = "idle" | "spinning" | "anticipation" | "wild" | "win" | "big-win";
const wait = (ms: number) =>
  new Promise<void>((resolve) =>
    window.setTimeout(
      resolve,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : ms,
    ),
  );

function SymbolArt({ id }: { id: GoldenTigerSymbolId }) {
  const crop = CROPS[id];
  return (
    <span
      className="gt-next-symbol-art"
      data-symbol={id}
      style={{ "--crop-x": `${crop.x}px`, "--crop-y": `${crop.y}px` } as CSSProperties}
      aria-hidden
    />
  );
}
function Reel({ column, turbo }: { column: number; turbo: boolean }) {
  const symbols = useMemo(
    () => [...STRIP.slice(column), ...STRIP.slice(0, column), ...STRIP],
    [column],
  );
  return (
    <div
      className="gt-next-reel"
      style={
        {
          left: `${column * 33.333}%`,
          "--reel-speed": `${turbo ? 280 : 560 + column * 55}ms`,
        } as CSSProperties
      }
      aria-hidden
    >
      <div className="gt-next-reel-track">
        {symbols.map((symbol, index) => (
          <div className="gt-next-reel-symbol" key={`${column}-${index}`}>
            <SymbolArt id={symbol} />
          </div>
        ))}
      </div>
      <span className="gt-next-reel-shade" />
    </div>
  );
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const [bet, setBet] = useState<number>(20);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL);
  const [win, setWin] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stopped, setStopped] = useState(3);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRounds, setAutoRounds] = useState(10);
  const busy = useRef(false);
  const stopAuto = useRef(false);
  useEffect(() => hydrateFromStorage(), []);

  const spin = useCallback(async () => {
    if (busy.current || !arcadeActions.placeBet(bet)) {
      if (!busy.current) playSound("lose", soundEnabled);
      return false;
    }
    busy.current = true;
    setWin(0);
    setWinning(new Set());
    setStopped(0);
    setPhase("spinning");
    playSound("spin", soundEnabled);
    const next = makeGoldenTigerGrid("base").slice(0, 9);
    const result = evaluateGoldenTiger(next, bet, "base");
    await wait(turbo ? 180 : 560);
    for (let column = 0; column < 3; column += 1) {
      if (column === 2 && next.some((symbol, index) => index % 3 < 2 && symbol === "wild")) {
        setPhase("anticipation");
        playSound("anticipation", soundEnabled);
        await wait(turbo ? 120 : 420);
      }
      setGrid((current) =>
        current.map((symbol, index) => (index % 3 === column ? (next[index] ?? symbol) : symbol)),
      );
      setStopped(column + 1);
      playSound("tick", soundEnabled);
      await wait(turbo ? 70 : 170);
    }
    const wilds = next.reduce<number[]>(
      (all, symbol, index) => (symbol === "wild" ? [...all, index] : all),
      [],
    );
    if (wilds.length) {
      setPhase("wild");
      playSound("tigerImpact", soundEnabled);
      await wait(turbo ? 160 : 480);
    }
    setWinning(result.winning);
    setWin(result.payout);
    const tier = goldenTigerWinTier(result.payout, bet);
    setPhase(tier === "big" || tier === "mega" ? "big-win" : result.payout > 0 ? "win" : "idle");
    if (result.payout > 0) arcadeActions.credit(result.payout);
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet,
      payout: result.payout,
      multiplier: result.payout > 0 ? result.payout / bet : 0,
      note: `${result.lines} linha(s) · ${wilds.length} WILD`,
    });
    playSound(
      tier === "big" || tier === "mega" ? "bigWin" : result.payout > 0 ? "win" : "lose",
      soundEnabled,
    );
    await wait(
      result.payout > 0 ? (turbo ? 260 : tier === "big" || tier === "mega" ? 1450 : 720) : 100,
    );
    setPhase("idle");
    busy.current = false;
    return true;
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busy.current || autoLeft > 0) return;
    stopAuto.current = false;
    setAutoOpen(false);
    for (let left = autoRounds; left > 0; left -= 1) {
      if (stopAuto.current) break;
      setAutoLeft(left);
      if (!(await spin())) break;
      await wait(turbo ? 90 : 260);
    }
    setAutoLeft(0);
  }, [autoLeft, autoRounds, spin, turbo]);
  const changeBet = (direction: -1 | 1) => {
    if (busy.current || autoLeft > 0) return;
    const current = Math.max(
      0,
      BETS.findIndex((value) => value === bet),
    );
    setBet(BETS[Math.max(0, Math.min(BETS.length - 1, current + direction))] ?? bet);
  };
  const insufficient = balance < bet;

  return (
    <main className="gt-next-page">
      <section className="gt-next-machine" data-phase={phase} aria-label="Golden Tiger">
        <img className="gt-next-base" src={ART} alt="" draggable={false} />
        <div className="gt-next-atmosphere" aria-hidden />
        <Link to="/" className="gt-next-back" aria-label="Voltar ao cassino">
          <ArrowLeft />
        </Link>
        <button
          className="gt-next-sound"
          type="button"
          onClick={() => arcadeActions.toggleSound()}
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
        >
          {soundEnabled ? <Volume2 /> : <VolumeX />}
        </button>
        <div className="gt-next-grid" aria-label="Grade de símbolos 3 por 3">
          {grid.map((symbol, index) => {
            const column = index % 3;
            return (
              <div
                className={cn(
                  "gt-next-cell",
                  winning.has(index) && "is-winning",
                  symbol === "wild" && "is-wild",
                  stopped === column + 1 && "is-landing",
                )}
                key={`${index}-${symbol}`}
              >
                <SymbolArt id={symbol} />
              </div>
            );
          })}
          {(phase === "spinning" || phase === "anticipation") &&
            [0, 1, 2]
              .filter((column) => column >= stopped)
              .map((column) => <Reel column={column} turbo={turbo} key={column} />)}
          <span className="gt-next-grid-glass" aria-hidden />
        </div>
        <div className="gt-next-tiger" aria-hidden>
          <span className="gt-next-paw" />
          <span className="gt-next-coins" />
        </div>
        {phase === "big-win" && (
          <div className="gt-next-big-win" role="status">
            <span>GRANDE GANHO</span>
            <strong>{formatCoins(win)}</strong>
          </div>
        )}
        {phase === "wild" && (
          <div className="gt-next-wild-burst" aria-hidden>
            <span>WILD!</span>
          </div>
        )}
        <div className="gt-next-status" aria-live="polite">
          {phase === "anticipation"
            ? "O TIGRE SENTIU A SORTE..."
            : phase === "wild"
              ? "WILD LIBERADO!"
              : win > 0
                ? `GANHO ${formatCoins(win)}`
                : "TIGRE DA SORTE!"}
        </div>
        <div className="gt-next-hud gt-next-hud--balance">
          <strong>{formatCoins(balance)}</strong>
          <span>SALDO</span>
        </div>
        <div className="gt-next-hud gt-next-hud--bet">
          <strong>{formatCoins(bet)}</strong>
          <span>APOSTA</span>
        </div>
        <div className="gt-next-hud gt-next-hud--win">
          <strong>{formatCoins(win)}</strong>
          <span>GANHO</span>
        </div>
        <button
          type="button"
          className={cn("gt-next-turbo", turbo && "is-active")}
          onClick={() => setTurbo((value) => !value)}
          disabled={busy.current || autoLeft > 0}
          aria-pressed={turbo}
        >
          <Zap />
          <span>TURBO</span>
        </button>
        <button
          type="button"
          className="gt-next-minus"
          onClick={() => changeBet(-1)}
          disabled={busy.current || autoLeft > 0}
          aria-label="Diminuir aposta"
        >
          −
        </button>
        <button
          type="button"
          className="gt-next-spin"
          onClick={() => void spin()}
          disabled={busy.current || autoLeft > 0 || insufficient}
          aria-label="Girar"
        >
          <span />
        </button>
        <button
          type="button"
          className="gt-next-plus"
          onClick={() => changeBet(1)}
          disabled={busy.current || autoLeft > 0}
          aria-label="Aumentar aposta"
        >
          +
        </button>
        {autoLeft > 0 ? (
          <button
            type="button"
            className="gt-next-auto is-active"
            onClick={() => {
              stopAuto.current = true;
            }}
            aria-label="Parar giro automático"
          >
            <strong>{autoLeft}</strong>
            <span>PARAR</span>
          </button>
        ) : (
          <button
            type="button"
            className="gt-next-auto"
            onClick={() => setAutoOpen(true)}
            disabled={busy.current || insufficient}
            aria-label="Configurar giro automático"
          >
            <strong>A</strong>
            <span>AUTO</span>
          </button>
        )}
        {autoOpen && (
          <div
            className="gt-next-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar giro automático"
          >
            <div>
              <h2>AUTO PLAY</h2>
              <p>{formatCoins(bet)} por rodada</p>
              <nav>
                {[10, 25, 50, 100].map((rounds) => (
                  <button
                    className={autoRounds === rounds ? "is-active" : ""}
                    type="button"
                    onClick={() => setAutoRounds(rounds)}
                    key={rounds}
                  >
                    {rounds}
                  </button>
                ))}
              </nav>
              <footer>
                <button type="button" onClick={() => setAutoOpen(false)}>
                  CANCELAR
                </button>
                <button type="button" onClick={() => void startAuto()}>
                  COMEÇAR
                </button>
              </footer>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
