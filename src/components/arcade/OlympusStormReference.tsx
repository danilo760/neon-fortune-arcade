import { Link } from "@tanstack/react-router";

import { AnimatedWinCounter } from "./AnimatedWinCounter";
import { useCallback, useEffect, useRef, useState } from "react";

import { olympusStormReferenceBase64 } from "@/assets/olympus-storm/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import {
  planOlympusRound,
  type OlympusSymbolId,
} from "@/lib/arcade/olympusStormMath";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./OlympusStormReference.css";

type Crop = { x: number; y: number; w: number; h: number };
type PresentationPhase =
  | "idle"
  | "spinning"
  | "landing"
  | "clusterWin"
  | "stormCharge"
  | "stormHit"
  | "collapse"
  | "settled";

const FULL_W = 941;
const FULL_H = 1672;

const CROPS: Record<OlympusSymbolId, Crop> = {
  bolt: { x: 75, y: 414, w: 258, h: 235 },
  crown: { x: 333, y: 414, w: 257, h: 235 },
  chalice: { x: 590, y: 414, w: 264, h: 235 },
  coin: { x: 75, y: 650, w: 258, h: 234 },
  hammer: { x: 333, y: 650, w: 257, h: 234 },
  orb: { x: 590, y: 650, w: 264, h: 234 },
  zeus: { x: 333, y: 884, w: 257, h: 233 },
};

const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;
const INITIAL_GRID: OlympusSymbolId[] = [
  "bolt", "crown", "chalice", "coin", "hammer", "orb",
  "coin", "hammer", "orb", "crown", "bolt", "chalice",
  "crown", "zeus", "bolt", "orb", "coin", "chalice",
  "hammer", "orb", "coin", "bolt", "crown", "zeus",
  "orb", "coin", "chalice", "hammer", "bolt", "crown",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function useReferenceBlob() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    try {
      if (olympusStormReferenceBase64.length < 83_000) throw new Error("asset incompleto");
      const binary = window.atob(olympusStormReferenceBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
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

function ReferenceSymbol({ id, src }: { id: OlympusSymbolId; src: string }) {
  const crop = CROPS[id];
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#031735]">
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
}

export function OlympusStormReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<OlympusSymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [winDuration, setWinDuration] = useState(0);
  const [roundBusy, setRoundBusy] = useState(false);
  const [phase, setPhase] = useState<PresentationPhase>("idle");
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [stormMultiplier, setStormMultiplier] = useState(1);
  const [cascadeNumber, setCascadeNumber] = useState(0);
  const [clusterCount, setClusterCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);

  const busyRef = useRef(false);
  const autoStopRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return false;
    }

    busyRef.current = true;
    setRoundBusy(true);
    setPhase("spinning");
    setWinning(new Set());
    setStormMultiplier(1);
    setCascadeNumber(0);
    setClusterCount(0);
    setWinDuration(0);
    setWin(0);
    playSound("spin", soundEnabled);

    // Toda a rodada, incluindo cascatas e multiplicadores, é pré-calculada.
    // A apresentação abaixo só revela esse plano e nunca muda o resultado.
    const plan = planOlympusRound(bet);

    await wait(turbo ? 170 : 460);
    setGrid(plan.initialGrid);
    setPhase("landing");
    playSound("tick", soundEnabled);
    await wait(turbo ? 90 : 240);

    let displayedTotal = 0;

    for (let index = 0; index < plan.cascades.length; index += 1) {
      const cascade = plan.cascades[index];
      if (!cascade) continue;

      setGrid(cascade.grid);
      setWinning(new Set(cascade.winning));
      setCascadeNumber(index + 1);
      setClusterCount(cascade.clusters.length);
      setStormMultiplier(1);
      setPhase("clusterWin");
      playSound("olympusCluster", soundEnabled);
      await wait(turbo ? 150 : Math.min(340 + index * 70, 620));

      if (cascade.multiplier > 1) {
        setStormMultiplier(cascade.multiplier);
        setPhase("stormCharge");
        playSound("olympusCharge", soundEnabled);
        await wait(turbo ? 210 : 560);

        setPhase("stormHit");
        setFlashKey((value) => value + 1);
        playSound("olympusHit", soundEnabled);
        await wait(turbo ? 110 : 260);
        playSound("olympusMultiplier", soundEnabled);
      }

      const targetTotal = displayedTotal + cascade.payout;
      const winDuration = turbo ? 140 : cascade.multiplier > 1 ? 620 : 360;
      setWinDuration(winDuration);
      setWin(targetTotal);
      await wait(winDuration);
      displayedTotal = targetTotal;

      setWinning(new Set());
      setPhase("collapse");
      playSound("olympusFall", soundEnabled);
      await wait(turbo ? 90 : 220);
      setGrid(cascade.nextGrid);
      await wait(turbo ? 80 : 190);
    }

    setGrid(plan.finalGrid);
    setWinning(new Set());
    setPhase("settled");
    setStormMultiplier(1);

    if (plan.payout > 0) arcadeActions.credit(plan.payout);
    arcadeActions.recordRound({
      slug: "olympus-storm",
      gameName: "Olympus Storm",
      bet,
      payout: plan.payout,
      multiplier: plan.payout > 0 ? plan.payout / bet : 0,
      note: `${plan.cascades.length} cascata(s) · ${plan.stormHits} tempestade(s)`,
    });

    playSound(
      plan.payout >= bet * 15 ? "bigWin" : plan.payout > 0 ? "win" : "lose",
      soundEnabled,
    );
    await wait(turbo ? 100 : 260);
    setPhase("idle");
    setRoundBusy(false);
    busyRef.current = false;
    return true;
  }, [bet, soundEnabled, turbo]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spinRound();
      if (!played) break;
      await wait(turbo ? 120 : 300);
    }
    setAutoLeft(0);
  }, [autoLeft, spinRound, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (roundBusy || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    if (roundBusy || autoLeft > 0) return;
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined) setBet(affordable);
  };

  const insufficient = bet > balance;
  const stormActive = phase === "stormCharge" || phase === "stormHit";
  const cascadeEnergy = Math.min(4, cascadeNumber);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div
        className={cn(
          "os-ref-machine relative mx-auto aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-[#021329] shadow-[0_0_100px_rgba(20,106,255,.16)] sm:rounded-[22px]",
          `os-ref-energy-${cascadeEnergy}`,
          stormActive && "os-ref-machine--storm",
        )}
      >
        {src ? (
          <img
            src={src}
            alt="Olympus Storm"
            draggable={false}
            className="absolute inset-0 size-full select-none object-fill"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#021329] p-8 text-center font-bold text-blue-100">
            {failed ? "Falha ao carregar a arte do Olympus Storm." : "Carregando Olympus Storm…"}
          </div>
        )}

        <div className={cn("os-ref-zeus-stage", stormActive && "is-charged", phase === "stormHit" && "is-striking")} aria-hidden>
          <div className="os-ref-zeus-aura" />
          <div className="os-ref-zeus-bolt" />
        </div>

        <Link
          to="/"
          aria-label="Voltar ao lobby"
          className="absolute right-[1.8%] top-[1.2%] z-50 size-[9%] rounded-full bg-transparent"
        />

        {src && (
          <div
            className={cn(
              "os-ref-grid absolute left-[7.95%] top-[24.76%] z-20 grid h-[53.05%] w-[82.9%] grid-cols-6 grid-rows-5 overflow-hidden",
              phase === "spinning" && "os-ref-grid--spinning",
              phase === "landing" && "os-ref-grid--landing",
              phase === "collapse" && "os-ref-grid--collapse",
              phase === "stormHit" && "os-ref-grid--storm-hit",
            )}
          >
            {grid.map((symbol, index) => (
              <div
                key={`${index}-${symbol}`}
                className={cn(
                  "os-ref-cell relative overflow-hidden border border-[#9fdcff]/20 bg-[#031735]",
                  winning.has(index) && "os-ref-win",
                )}
              >
                <ReferenceSymbol id={symbol} src={src} />
              </div>
            ))}
          </div>
        )}

        {flashKey > 0 && (
          <div key={flashKey} className="os-ref-lightning-flash pointer-events-none absolute inset-0 z-40" />
        )}

        {stormActive && stormMultiplier > 1 && (
          <div className="os-ref-storm-message absolute left-1/2 top-[43%] z-[65] -translate-x-1/2 rounded-2xl border-2 border-cyan-100 bg-[#001d4d]/92 px-5 py-3 text-center font-serif text-3xl font-black text-white shadow-[0_0_38px_rgba(50,185,255,.95)]">
            {phase === "stormCharge" ? "STORM CHARGE" : `×${stormMultiplier}`}
          </div>
        )}

        {win >= bet * 15 && !roundBusy && (
          <div className="os-ref-big-win pointer-events-none absolute left-1/2 top-[43%] z-[64] -translate-x-1/2 rounded-2xl border-2 border-yellow-100 bg-[#071b58]/94 px-5 py-3 text-center font-serif text-3xl font-black text-yellow-100 shadow-[0_0_42px_rgba(95,205,255,.82)]">
            BIG WIN
          </div>
        )}

        <div className="absolute left-[25.5%] top-[77.7%] z-35 flex h-[6.5%] w-[49%] items-center justify-center rounded-[18px] bg-[#002a62]/95 px-2 text-center shadow-[inset_0_0_12px_rgba(70,175,255,.45)]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[.18em] text-blue-200">
              {roundBusy && cascadeNumber > 0 ? `CASCADE ${cascadeNumber} · ${clusterCount} CLUSTER${clusterCount === 1 ? "" : "S"}` : "WIN"}
            </p>
            <p className="font-serif text-[clamp(1.1rem,7vw,2rem)] font-black leading-none text-[#ffd95b] tabular-nums drop-shadow-[0_2px_0_#5b3100]">
              <AnimatedWinCounter value={win} duration={winDuration} />
            </p>
            {stormMultiplier > 1 && stormActive && (
              <p className="mt-0.5 text-[8px] font-black text-cyan-200">STORM ×{stormMultiplier}</p>
            )}
          </div>
        </div>

        <div className="absolute left-[3.2%] top-[85.1%] z-35 flex h-[4.2%] w-[27.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(balance)}
        </div>
        <div className="absolute right-[3.1%] top-[85.1%] z-35 flex h-[4.2%] w-[23.5%] items-center justify-center rounded-lg bg-[#021b3a]/95 px-1 font-black text-white tabular-nums">
          {formatCoins(bet)}
        </div>

        <button
          type="button"
          onClick={() => changeBet(-1)}
          disabled={roundBusy || autoLeft > 0}
          aria-label="Diminuir aposta"
          className="absolute right-[27.8%] top-[84.3%] z-50 size-[7%] rounded-full disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => changeBet(1)}
          disabled={roundBusy || autoLeft > 0}
          aria-label="Aumentar aposta"
          className="absolute right-[1.2%] top-[84.3%] z-50 size-[7%] rounded-full disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => setTurbo((value) => !value)}
          aria-label="Alternar turbo"
          aria-pressed={turbo}
          disabled={roundBusy}
          className={cn(
            "absolute right-[1.3%] top-[78.1%] z-50 size-[8.8%] rounded-full disabled:opacity-50",
            turbo && "ring-2 ring-cyan-100 shadow-[0_0_25px_#45c8ff]",
          )}
        />

        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={() => { autoStopRef.current = true; }}
            aria-label="Parar auto play"
            className="absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl"
          >
            <span className="absolute right-0 top-0 rounded-full bg-cyan-500 px-1.5 text-[9px] font-black text-white">{autoLeft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAuto()}
            disabled={roundBusy || insufficient || !src}
            aria-label="Auto play"
            className="absolute left-[4.5%] top-[92.6%] z-50 h-[5.7%] w-[25%] rounded-xl disabled:opacity-40"
          />
        )}

        <button
          type="button"
          onClick={setMaxBet}
          disabled={roundBusy || autoLeft > 0}
          aria-label="Aposta máxima"
          className="absolute right-[4.4%] top-[92.6%] z-50 h-[5.7%] w-[25.5%] rounded-xl disabled:opacity-40"
        />

        <button
          type="button"
          onClick={() => void spinRound()}
          disabled={roundBusy || autoLeft > 0 || insufficient || !src}
          aria-label="Girar Olympus Storm"
          aria-busy={roundBusy}
          className={cn(
            "os-ref-spin-button absolute left-[35.5%] top-[85.1%] z-50 size-[29%] rounded-full disabled:cursor-not-allowed disabled:opacity-45",
            roundBusy && "scale-95",
          )}
        />

        {insufficient && !roundBusy && (
          <div className="absolute inset-x-[12%] bottom-[.6%] z-[70] rounded-xl border border-blue-200/70 bg-blue-950/95 px-3 py-2 text-center text-[10px] font-bold text-blue-50">
            Saldo fictício insuficiente — recarregue moedas grátis no lobby.
          </div>
        )}
        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.16em] text-blue-100/70">
          MOEDAS FICTÍCIAS · SEM VALOR REAL
        </div>
      </div>
    </main>
  );
}
