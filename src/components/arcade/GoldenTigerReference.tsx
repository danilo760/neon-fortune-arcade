import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { goldenTigerReferenceBase64 } from "@/assets/golden-tiger/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import {
  createGoldenTigerRespin,
  evaluateGoldenTiger,
  goldenTigerWinTier,
  makeGoldenTigerGrid,
  respinGoldenTigerGrid,
  type GoldenTigerSpinResult,
  type GoldenTigerSymbolId,
  type GoldenTigerWinTier,
} from "@/lib/arcade/goldenTigerMath";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import "./GoldenTigerReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type PresentationPhase =
  | "idle"
  | "spinning"
  | "landing"
  | "evaluating"
  | "smallWin"
  | "bigWin"
  | "respinTrigger"
  | "respinPlaying"
  | "fullGrid";
type TigerReaction = "idle" | "watch" | "notice" | "excited" | "celebrate" | "bigWin" | "miss";

const FULL_W = 940;
const FULL_H = 1672;
const CELL_W = 160;
const CELL_H = 175;

const CROPS: Record<GoldenTigerSymbolId, Crop> = {
  ingot: { x: 63, y: 544, w: CELL_W, h: CELL_H },
  scatter: { x: 223, y: 544, w: CELL_W, h: CELL_H },
  orange: { x: 383, y: 544, w: CELL_W, h: CELL_H },
  fortuneBag: { x: 543, y: 544, w: CELL_W, h: CELL_H },
  firecracker: { x: 703, y: 544, w: CELL_W, h: CELL_H },
  wild: { x: 223, y: 719, w: CELL_W, h: CELL_H },
  lion: { x: 703, y: 719, w: CELL_W, h: CELL_H },
  jade: { x: 63, y: 894, w: CELL_W, h: CELL_H },
  lantern: { x: 543, y: 894, w: CELL_W, h: CELL_H },
};

const REEL_STRIP_SYMBOLS: GoldenTigerSymbolId[] = [
  "ingot",
  "jade",
  "orange",
  "fortuneBag",
  "firecracker",
  "wild",
  "lantern",
  "lion",
  "scatter",
  "orange",
  "jade",
  "fortuneBag",
];

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const INITIAL_GRID: GoldenTigerSymbolId[] = [
  "ingot",
  "orange",
  "jade",
  "fortuneBag",
  "wild",
  "firecracker",
  "lantern",
  "lion",
  "orange",
];

function reducedMotionNow() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotionNow() ? 0 : ms));
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function useReferenceBlob() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      const binary = window.atob(goldenTigerReferenceBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      setSrc(objectUrl);
    } catch {
      setFailed(true);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return { src, failed };
}

const ReferenceSymbol = memo(function ReferenceSymbol({ id, src }: { id: GoldenTigerSymbolId; src: string }) {
  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#4c0612]">
      <img
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: `${(FULL_W / crop.w) * 100}%`,
          height: `${(FULL_H / crop.h) * 100}%`,
          left: `${-(crop.x / crop.w) * 100}%`,
          top: `${-(crop.y / crop.h) * 100}%`,
        }}
      />
    </div>
  );
});

const GoldenReelStrip = memo(function GoldenReelStrip({
  column,
  src,
  turbo,
}: {
  column: number;
  src: string;
  turbo: boolean;
}) {
  const rotated = useMemo(() => {
    const offset = (column * 2) % REEL_STRIP_SYMBOLS.length;
    const sequence = [...REEL_STRIP_SYMBOLS.slice(offset), ...REEL_STRIP_SYMBOLS.slice(0, offset)];
    return [...sequence, ...sequence];
  }, [column]);

  const style = {
    left: `${column * (100 / 3)}%`,
    "--gt-strip-duration": `${turbo ? 320 + column * 12 : 680 + column * 28}ms`,
    "--gt-strip-delay": `${-column * 73}ms`,
  } as CSSProperties;

  return (
    <div className="gt-ref-live-reel" style={style} aria-hidden>
      <div className="gt-ref-live-reel__track">
        {rotated.map((symbol, index) => (
          <div className="gt-ref-live-reel__cell" key={`${column}-${index}-${symbol}`}>
            <ReferenceSymbol id={symbol} src={src} />
          </div>
        ))}
      </div>
      <span className="gt-ref-live-reel__motion" />
    </div>
  );
});

const GoldenCellStrip = memo(function GoldenCellStrip({
  index,
  src,
  turbo,
}: {
  index: number;
  src: string;
  turbo: boolean;
}) {
  const sequence = useMemo(() => {
    const offset = (index * 3) % REEL_STRIP_SYMBOLS.length;
    const rotated = [...REEL_STRIP_SYMBOLS.slice(offset), ...REEL_STRIP_SYMBOLS.slice(0, offset)];
    return [...rotated, ...rotated];
  }, [index]);

  const style = {
    "--gt-cell-strip-duration": `${turbo ? 250 : 520}ms`,
    "--gt-cell-strip-delay": `${-(index % 3) * 41}ms`,
  } as CSSProperties;

  return (
    <div className="gt-ref-cell-strip" style={style} aria-hidden>
      <div className="gt-ref-cell-strip__track">
        {sequence.map((symbol, stripIndex) => (
          <div className="gt-ref-cell-strip__item" key={`${index}-${stripIndex}-${symbol}`}>
            <ReferenceSymbol id={symbol} src={src} />
          </div>
        ))}
      </div>
      <span className="gt-ref-cell-strip__motion" />
    </div>
  );
});

const TigerStage = memo(function TigerStage() {
  return (
    <div className="gt-ref-tiger-stage" aria-hidden>
      <span className="gt-ref-tiger-rim" />
      <span className="gt-ref-tiger-live-eyes" />
      <span className="gt-ref-tiger-live-paw" />
      <span className="gt-ref-tiger-foreground" />
    </div>
  );
});

function FeatureStatusBadge({ active, locked }: { active: boolean; locked: number }) {
  return (
    <div
      className={cn(
        "gt-ref-respin-badge absolute left-[4.6%] top-[71.2%] z-40 flex h-[5.8%] w-[28%] flex-col items-center justify-center rounded-[18px] text-center",
        active && "gt-ref-respin-badge--active",
      )}
      role="status"
      aria-live="polite"
    >
      <strong>{active ? "TIGRE DA SORTE" : "RESPIN"}</strong>
      <span>{active ? `${locked}/9 TRAVADOS` : "RECURSO ALEATÓRIO"}</span>
    </div>
  );
}

function NumberPatch({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute z-30 flex items-center justify-center rounded-lg bg-[#270006]/95 px-1 font-black text-[#fff5cf] shadow-[inset_0_0_7px_rgba(255,202,55,.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function tierPhase(tier: GoldenTigerWinTier): PresentationPhase {
  return tier === "big" || tier === "mega"
    ? "bigWin"
    : tier === "small" || tier === "nice"
      ? "smallWin"
      : "evaluating";
}

function tierLabel(tier: GoldenTigerWinTier) {
  if (tier === "mega") return "MEGA WIN";
  if (tier === "big") return "BIG WIN";
  if (tier === "nice") return "NICE WIN";
  if (tier === "small") return "WIN";
  return null;
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();
  const reducedMotion = useReducedMotionPreference();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<GoldenTigerSymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRounds, setAutoRounds] = useState(10);
  const [phase, setPhase] = useState<PresentationPhase>("idle");
  const [tigerReaction, setTigerReaction] = useState<TigerReaction>("idle");
  const [winTier, setWinTier] = useState<GoldenTigerWinTier>("none");
  const [respinActive, setRespinActive] = useState(false);
  const [respinRolling, setRespinRolling] = useState(false);
  const [lockedSymbols, setLockedSymbols] = useState<Set<number>>(() => new Set());

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(async (): Promise<GoldenTigerSpinResult | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;

    if (!arcadeActions.placeBet(bet)) {
      busyRef.current = false;
      playSound("lose", soundEnabled);
      return null;
    }

    setSpinning(true);
    setPhase("spinning");
    setTigerReaction("idle");
    setStoppedColumns(0);
    setLandingColumn(-1);
    setWinning(new Set());
    setWinTier("none");
    setWinDuration(0);
    setWin(0);
    setRespinActive(false);
    setRespinRolling(false);
    setLockedSymbols(new Set());
    playSound("spin", soundEnabled);

    try {
      let finalGrid = makeGoldenTigerGrid("base");
      let result = evaluateGoldenTiger(finalGrid, bet, "base");
      let respinTriggered = false;

      await wait(turbo ? 150 : 450);

      for (let column = 0; column < 3; column += 1) {
        setPhase("landing");
        setGrid((current) =>
          current.map((symbol, index) => (index % 3 === column ? (finalGrid[index] ?? symbol) : symbol)),
        );
        setStoppedColumns(column + 1);
        setLandingColumn(column);
        playSound("tick", soundEnabled);
        await wait(turbo ? 70 : 190);
      }

      setGrid(finalGrid);
      setLandingColumn(-1);
      setStoppedColumns(3);

      const respin = createGoldenTigerRespin(finalGrid);
      if (respin) {
        respinTriggered = true;
        let state = respin;
        setRespinActive(true);
        setLockedSymbols(new Set(state.locked));
        setPhase("respinTrigger");
        setTigerReaction("excited");
        playSound("tigerLuckyFeature", soundEnabled);
        await wait(turbo ? 220 : 560);

        while (state.spinsLeft > 0 && state.locked.size < 9) {
          setPhase("respinPlaying");
          setRespinRolling(true);
          setTigerReaction("watch");
          playSound("tigerRespinRoll", soundEnabled);
          await wait(turbo ? 150 : 380);

          const previousLocked = state.locked.size;
          const next = respinGoldenTigerGrid(finalGrid, state);
          finalGrid = next.grid;
          state = next.state;
          setGrid(finalGrid);
          setLockedSymbols(new Set(state.locked));
          setRespinRolling(false);

          if (state.locked.size > previousLocked) {
            setTigerReaction(state.locked.size === 9 ? "celebrate" : "notice");
            playSound("tigerSymbolLock", soundEnabled);
            await wait(turbo ? 150 : 340);
          } else {
            setTigerReaction("miss");
            playSound("tigerMiss", soundEnabled);
            await wait(turbo ? 100 : 230);
          }
        }

        result = evaluateGoldenTiger(finalGrid, bet, "respin");
        setRespinRolling(false);
      }

      setGrid(finalGrid);
      setWinning(result.winning);
      setPhase(result.isFullGrid ? "fullGrid" : "evaluating");

      if (result.payout > 0) arcadeActions.credit(result.payout);

      arcadeActions.recordRound({
        slug: "golden-tiger",
        gameName: "Golden Tiger",
        bet,
        payout: result.payout,
        multiplier: result.payout > 0 ? result.payout / bet : 0,
        note: `3x3 · ${result.lines} linha(s) · ${respinTriggered ? "Tigre da Sorte" : "Giro base"}${result.isFullGrid ? " · TELA CHEIA x10" : ""}`,
      });

      const tier = goldenTigerWinTier(result.payout, bet);
      const duration = tier === "small" ? 320 : tier === "nice" ? 620 : tier === "big" ? 980 : 1_350;
      const animatedDuration = result.payout > 0 && !reducedMotion && tier !== "none" ? duration : 0;

      setWinTier(tier);
      setPhase(result.isFullGrid ? "fullGrid" : tierPhase(tier));
      setWinDuration(animatedDuration);
      setWin(result.payout);

      if (result.isFullGrid && result.payout > 0) {
        setTigerReaction("bigWin");
        playSound("tigerFullGrid", soundEnabled);
      } else if (tier === "big" || tier === "mega") {
        setTigerReaction("bigWin");
        playSound("bigWin", soundEnabled);
      } else if (result.payout > 0) {
        setTigerReaction("celebrate");
        playSound("win", soundEnabled);
      } else {
        setTigerReaction("idle");
        playSound("lose", soundEnabled);
      }

      if (animatedDuration > 0) await wait(animatedDuration);
      if (tier === "big" || tier === "mega" || result.isFullGrid) {
        await wait(turbo ? 180 : result.isFullGrid ? 760 : 480);
      }

      setTigerReaction("idle");
      setPhase("idle");
      setRespinActive(false);
      setLockedSymbols(new Set());
      return result;
    } finally {
      setRespinRolling(false);
      setSpinning(false);
      busyRef.current = false;
    }
  }, [bet, reducedMotion, soundEnabled, turbo]);

  const spin = useCallback(async () => Boolean(await spinRound()), [spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    setAutoOpen(false);

    for (let left = autoRounds; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 100 : 250);
    }
    setAutoLeft(0);
  }, [autoLeft, autoRounds, spin, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined && !spinning && autoLeft === 0) setBet(affordable);
  };

  const insufficient = bet > balance;
  const controlsLocked = spinning || autoLeft > 0;
  const currentTierLabel = tierLabel(winTier);
  const hasWinningSymbols = winning.size > 0;
  const statusText =
    phase === "fullGrid"
      ? "TELA CHEIA · MULTIPLICADOR x10"
      : respinActive
        ? respinRolling
          ? "TIGRE DA SORTE · RESPIN"
          : `TIGRE DA SORTE · ${lockedSymbols.size}/9 TRAVADOS`
        : currentTierLabel ?? "3×3 · 5 LINHAS FIXAS · RESPIN ALEATÓRIO";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div
        className={cn(
          "gt-ref-machine relative mx-auto aspect-[940/1672] w-full max-w-[430px] overflow-hidden bg-[#240003] shadow-[0_0_90px_rgba(0,0,0,.96)] sm:rounded-[22px]",
          respinActive && "gt-ref-respin-mode",
          hasWinningSymbols && "gt-ref-machine--has-win",
        )}
        data-phase={phase}
        data-tiger={tigerReaction}
        data-respin={respinActive || undefined}
      >
        {src ? (
          <img
            src={src}
            alt="Golden Tiger"
            draggable={false}
            className="absolute inset-0 size-full select-none object-fill"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#260003] p-8 text-center font-bold text-yellow-100">
            {failed ? "Falha ao carregar a arte do Golden Tiger." : "Carregando Golden Tiger…"}
          </div>
        )}

        <div className="gt-ref-machine__ambient" aria-hidden />
        <div className="gt-ref-branding" aria-label="Golden Tiger">
          <span>NEON FORTUNE</span>
          <strong>
            GOLDEN
            <br />
            TIGER
          </strong>
        </div>
        <div className="gt-ref-jackpots" aria-label="Jackpots em moedas fictícias">
          <p>
            <span>GRAND</span>
            <b>1.250.000</b>
          </p>
          <p>
            <span>MAJOR</span>
            <b>125.000</b>
          </p>
          <p>
            <span>MINOR</span>
            <b>25.000</b>
          </p>
          <p>
            <span>MINI</span>
            <b>5.000</b>
          </p>
          <small>MOEDAS</small>
        </div>
        <TigerStage />

        <Link
          to="/"
          aria-label="Voltar ao lobby"
          className="absolute left-[1.2%] top-[.8%] z-50 grid size-[8.8%] place-items-center rounded-full bg-black/10 text-transparent"
        >
          <ArrowLeft className="size-4 opacity-0" />
        </Link>
        <button
          type="button"
          onClick={() => {
            arcadeActions.toggleSound();
            playSound("click", !soundEnabled);
          }}
          aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
          aria-pressed={soundEnabled}
          className="absolute right-[9.3%] top-[.8%] z-50 size-[8.8%] rounded-full bg-transparent"
        >
          {soundEnabled ? (
            <Volume2 className="mx-auto size-4 opacity-0" />
          ) : (
            <VolumeX className="mx-auto size-4 opacity-0" />
          )}
        </button>

        {src && (
          <div
            className={cn(
              "gt-ref-grid absolute left-[6.7%] top-[32.53%] z-20 grid h-[31.4%] w-[85.1%] grid-cols-3 grid-rows-3 overflow-hidden",
              respinActive && "gt-ref-grid--respin",
            )}
            data-spinning={(spinning && !respinActive) || undefined}
            data-respin={respinActive || undefined}
          >
            {grid.map((symbol, index) => {
              const column = index % 3;
              const locked = lockedSymbols.has(index);
              const isLanding = spinning && !respinActive && landingColumn === column;
              const cellRolling = respinRolling && !locked;

              return (
                <div
                  key={index}
                  className={cn(
                    "gt-ref-reel-cell relative overflow-hidden border-[1px] border-[#f8bd35]/45 bg-[#4b0710]",
                    isLanding && "gt-ref-land",
                    winning.has(index) && "gt-ref-win",
                    locked && "gt-ref-cell--locked",
                    respinActive && !locked && "gt-ref-cell--unlocked",
                    hasWinningSymbols && !winning.has(index) && "gt-ref-cell--dim",
                    ["ingot", "jade", "fortuneBag", "wild"].includes(symbol) && "gt-ref-cell--premium-symbol",
                  )}
                >
                  <ReferenceSymbol id={symbol} src={src} />
                  {cellRolling && !reducedMotion && <GoldenCellStrip index={index} src={src} turbo={turbo} />}
                  {locked && <span className="gt-ref-lock-frame" aria-hidden />}
                </div>
              );
            })}

            {spinning && !respinActive && !reducedMotion &&
              Array.from({ length: 3 }, (_, column) =>
                column >= stoppedColumns ? (
                  <GoldenReelStrip key={`live-reel-${column}`} column={column} src={src} turbo={turbo} />
                ) : null,
              )}
          </div>
        )}

        <div
          className="absolute left-[18%] top-[63.7%] z-35 flex h-[7.2%] w-[69%] items-center justify-center rounded-[28px] border-2 border-[#ffc52b] bg-[linear-gradient(180deg,rgba(122,0,7,.97),rgba(58,0,4,.98))] px-4 text-center shadow-[0_0_22px_rgba(255,67,0,.45)]"
          aria-live="polite"
        >
          <div>
            <p className="font-serif text-[clamp(.68rem,3.8vw,1.1rem)] font-black uppercase leading-tight text-[#ffe475] drop-shadow-[0_2px_0_#7b1500]">
              {statusText}
            </p>
            {respinActive && (
              <p className="mt-0.5 text-[9px] font-black tracking-[.12em] text-emerald-200">
                SÍMBOLOS TRAVADOS {lockedSymbols.size}/9
              </p>
            )}
          </div>
        </div>

        <FeatureStatusBadge active={respinActive} locked={lockedSymbols.size} />

        <NumberPatch className="left-[5%] top-[79.1%] h-[3.4%] w-[25.5%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">
          {formatCoins(balance)}
        </NumberPatch>
        <NumberPatch className="left-[34.4%] top-[77.9%] h-[4.4%] w-[31.2%] text-[clamp(1rem,6vw,1.65rem)] tabular-nums text-[#ffd73f]">
          <AnimatedWinCounter value={win} duration={winDuration} />
        </NumberPatch>
        <NumberPatch className="left-[75%] top-[79.1%] h-[3.4%] w-[16.6%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">
          {formatCoins(bet)}
        </NumberPatch>

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={controlsLocked}
          aria-label="Diminuir aposta"
          className="absolute left-[69%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={controlsLocked}
          aria-label="Aumentar aposta"
          className="absolute right-[2.3%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          disabled={controlsLocked}
          aria-pressed={turbo}
          aria-label="Alternar turbo"
          className={cn(
            "absolute left-[4.2%] top-[86.1%] z-50 h-[8.3%] w-[17.7%] rounded-[28px] disabled:cursor-not-allowed disabled:opacity-45",
            turbo && "ring-2 ring-yellow-200 bg-amber-300/20 shadow-[0_0_25px_#ffb000]",
          )}
        >
          <span
            className={cn(
              "absolute inset-x-0 bottom-1 text-center text-[8px] font-black tracking-wide",
              turbo ? "text-yellow-100" : "text-yellow-100/70",
            )}
          >
            {turbo ? "TURBO ATIVO" : "TURBO"}
          </span>
        </button>

        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => {
              autoStopRef.current = true;
            }}
            aria-label="Parar auto play"
            className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px]"
          >
            <span className="absolute right-0 top-0 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white">
              {autoLeft}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAutoOpen(true)}
            disabled={spinning || insufficient || !src}
            aria-label={`Configurar auto play: ${autoRounds} rodadas`}
            className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px] disabled:opacity-40"
          />
        )}

        {autoOpen && (
          <div
            className="absolute inset-0 z-[80] grid place-items-end bg-black/60 px-5 pb-[18%]"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar auto play"
          >
            <div className="w-full rounded-2xl border border-yellow-300/70 bg-[#3a0508] p-4 text-center shadow-[0_12px_40px_rgba(0,0,0,.75)]">
              <p className="text-xs font-black tracking-[.18em] text-yellow-200">AUTO PLAY</p>
              <p className="mt-1 text-[11px] text-yellow-50/80">{formatCoins(bet)} MOEDAS por rodada</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => setAutoRounds(rounds)}
                    className={cn(
                      "min-h-11 rounded-lg border text-xs font-black",
                      autoRounds === rounds
                        ? "border-yellow-200 bg-yellow-400 text-[#4a0800]"
                        : "border-yellow-200/35 bg-black/25 text-yellow-100",
                    )}
                  >
                    {rounds}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAutoOpen(false)}
                  className="min-h-11 rounded-lg border border-yellow-200/35 text-xs font-black text-yellow-100"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={() => void startAuto()}
                  className="min-h-11 rounded-lg bg-yellow-400 text-xs font-black text-[#4a0800]"
                >
                  INICIAR {autoRounds}
                </button>
              </div>
              <small className="mt-2 block text-[9px] font-bold text-yellow-50/65">
                MOEDAS FICTÍCIAS · SEM VALOR REAL
              </small>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={setMaxBet}
          disabled={controlsLocked}
          aria-label="Aposta máxima"
          className="absolute right-[4.3%] top-[86.1%] z-50 h-[8.3%] w-[25%] rounded-[28px] disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spin()}
          disabled={spinning || autoLeft > 0 || insufficient || !src}
          aria-label="Girar Golden Tiger"
          aria-busy={spinning}
          className={cn(
            "gt-ref-spin-button absolute left-[34%] top-[82.7%] z-50 size-[29.5%] rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            spinning && "scale-95",
          )}
        />

        {(winTier === "big" || winTier === "mega" || phase === "fullGrid") && win > 0 && (
          <div
            className={cn(
              "gt-ref-win-callout",
              phase === "fullGrid" ? "gt-ref-win-callout--mega" : `gt-ref-win-callout--${winTier}`,
            )}
            aria-live="polite"
          >
            <span>{phase === "fullGrid" ? "FULL GRID x10" : tierLabel(winTier)}</span>
            <strong>
              <AnimatedWinCounter value={win} duration={winDuration} />
            </strong>
          </div>
        )}

        {insufficient && (
          <div className="absolute inset-x-[12%] bottom-[.8%] z-[70] rounded-xl border border-red-200/80 bg-red-950/95 px-3 py-2 text-center text-[10px] font-bold text-red-50">
            Saldo fictício insuficiente — recarregue moedas grátis no lobby.
          </div>
        )}

        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.18em] text-yellow-100/75">
          MOEDAS FICTÍCIAS · SEM VALOR REAL
        </div>
      </div>
    </main>
  );
}
