import { Link } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { goldenTigerReferenceBase64 } from "@/assets/golden-tiger/referenceData";
import { formatCoins } from "@/lib/arcade/format";
import { playSound } from "@/lib/arcade/sound";
import { arcadeActions, hydrateFromStorage, useArcade } from "@/lib/arcade/store";
import { cn } from "@/lib/utils";

import "./GoldenTigerReference.css";

type SymbolId =
  | "wild"
  | "scatter"
  | "ingot"
  | "orange"
  | "fortuneBag"
  | "firecracker"
  | "jade"
  | "lantern"
  | "lion";

type SymbolDef = { id: SymbolId; weight: number; pay: number };
type SpinResult = {
  payout: number;
  winning: Set<number>;
  scatterIndexes: Set<number>;
  scatterCount: number;
  bonusAward: number;
  lines: number;
};

type Crop = { x: number; y: number; w: number; h: number };

const FULL_W = 940;
const FULL_H = 1672;
const CELL_W = 160;
const CELL_H = 175;

const CROPS: Record<SymbolId, Crop> = {
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

const SYMBOLS: readonly SymbolDef[] = [
  { id: "wild", weight: 5, pay: 12 },
  { id: "scatter", weight: 8, pay: 0 },
  { id: "lion", weight: 8, pay: 8 },
  { id: "ingot", weight: 11, pay: 6 },
  { id: "fortuneBag", weight: 13, pay: 5 },
  { id: "firecracker", weight: 15, pay: 4 },
  { id: "jade", weight: 17, pay: 3.2 },
  { id: "lantern", weight: 19, pay: 2.6 },
  { id: "orange", weight: 22, pay: 2.1 },
];
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
const BET_STEPS = [10, 50, 100, 200, 500, 1_000, 5_000, 10_000] as const;

const PAYLINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [0, 6, 12, 8, 4],
  [10, 6, 2, 8, 14],
  [0, 1, 7, 3, 4],
  [10, 11, 7, 13, 14],
  [5, 1, 2, 3, 9],
  [5, 11, 12, 13, 9],
  [0, 6, 7, 8, 14],
] as const;

const INITIAL_GRID: SymbolId[] = [
  "ingot", "scatter", "orange", "fortuneBag", "firecracker",
  "firecracker", "wild", "ingot", "scatter", "lion",
  "jade", "fortuneBag", "scatter", "lantern", "orange",
];

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function pickSymbol(): SymbolId {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return "orange";
}

function makeGrid(): SymbolId[] {
  return Array.from({ length: 15 }, pickSymbol);
}

function bonusForScatters(count: number) {
  if (count >= 5) return 20;
  if (count === 4) return 12;
  if (count === 3) return 8;
  return 0;
}

function evaluate(grid: readonly SymbolId[], bet: number): SpinResult {
  let payout = 0;
  let lines = 0;
  const winning = new Set<number>();
  const scatterIndexes = new Set<number>();

  grid.forEach((symbol, index) => {
    if (symbol === "scatter") scatterIndexes.add(index);
  });

  for (const line of PAYLINES) {
    const firstIndex = line[0];
    if (firstIndex === undefined) continue;
    const first = grid[firstIndex];
    if (!first || first === "scatter") continue;

    let target: SymbolId = first;
    if (target === "wild") {
      for (const position of line) {
        const candidate = grid[position];
        if (candidate && candidate !== "wild" && candidate !== "scatter") {
          target = candidate;
          break;
        }
      }
    }

    let count = 0;
    const matched: number[] = [];
    for (const position of line) {
      const current = grid[position];
      if (current === target || current === "wild") {
        count += 1;
        matched.push(position);
      } else {
        break;
      }
    }

    if (count < 3) continue;
    const def = SYMBOL_BY_ID.get(target) ?? SYMBOL_BY_ID.get("wild");
    if (!def) continue;
    const lengthBoost = count === 5 ? 2.5 : count === 4 ? 1.6 : 1;
    payout += bet * def.pay * lengthBoost;
    lines += 1;
    matched.forEach((position) => winning.add(position));
  }

  return {
    payout: Math.round(payout),
    winning,
    scatterIndexes,
    scatterCount: scatterIndexes.size,
    bonusAward: bonusForScatters(scatterIndexes.size),
    lines,
  };
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

function ReferenceSymbol({ id, src }: { id: SymbolId; src: string }) {
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
}

function NumberPatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={cn("absolute z-30 flex items-center justify-center rounded-lg bg-[#270006]/95 px-1 font-black text-[#fff5cf] shadow-[inset_0_0_7px_rgba(255,202,55,.18)]", className)}>
      {children}
    </div>
  );
}

export function GoldenTigerReference() {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);
  const { src, failed } = useReferenceBlob();

  const [bet, setBet] = useState<number>(200);
  const [grid, setGrid] = useState<SymbolId[]>(INITIAL_GRID);
  const [win, setWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedColumns, setStoppedColumns] = useState(5);
  const [landingColumn, setLandingColumn] = useState(-1);
  const [winning, setWinning] = useState<Set<number>>(() => new Set());
  const [scatters, setScatters] = useState<Set<number>>(() => new Set());
  const [anticipation, setAnticipation] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const [bonusMessage, setBonusMessage] = useState<string | null>(null);

  const busyRef = useRef(false);
  const stoppedRef = useRef(5);
  const autoStopRef = useRef(false);
  const bonusRef = useRef(false);

  useEffect(() => hydrateFromStorage(), []);

  const spinRound = useCallback(async (free: boolean): Promise<SpinResult | null> => {
    if (busyRef.current) return null;
    if (!free && !arcadeActions.placeBet(bet)) {
      playSound("lose", soundEnabled);
      return null;
    }

    busyRef.current = true;
    setSpinning(true);
    setStoppedColumns(0);
    stoppedRef.current = 0;
    setLandingColumn(-1);
    setWinning(new Set());
    setScatters(new Set());
    setAnticipation(0);
    setWin(0);
    playSound("spin", soundEnabled);

    const finalGrid = makeGrid();
    const result = evaluate(finalGrid, bet);

    const rolling = window.setInterval(() => {
      setGrid((current) => current.map((symbol, index) => (index % 5 < stoppedRef.current ? symbol : pickSymbol())));
    }, turbo ? 48 : 72);

    await wait(turbo ? 180 : 520);
    let revealedScatters = 0;

    for (let column = 0; column < 5; column += 1) {
      setGrid((current) => current.map((symbol, index) => (index % 5 === column ? (finalGrid[index] ?? symbol) : symbol)));
      stoppedRef.current = column + 1;
      setStoppedColumns(column + 1);
      setLandingColumn(column);
      playSound("tick", soundEnabled);

      revealedScatters = 0;
      for (let index = 0; index < finalGrid.length; index += 1) {
        if (index % 5 <= column && finalGrid[index] === "scatter") revealedScatters += 1;
      }

      const columnsRemain = column < 4;
      if (columnsRemain && revealedScatters > 0) {
        const level = Math.min(2, revealedScatters);
        setAnticipation(level);
        playSound("anticipation", soundEnabled);
        await wait(turbo ? (level === 2 ? 430 : 260) : (level === 2 ? 1250 : 760));
      } else {
        setAnticipation(0);
        await wait(turbo ? 85 : 210);
      }
    }

    window.clearInterval(rolling);
    setGrid(finalGrid);
    setLandingColumn(-1);
    setStoppedColumns(5);
    stoppedRef.current = 5;
    setAnticipation(0);
    setSpinning(false);
    setWinning(result.winning);
    setScatters(result.scatterIndexes);
    setWin(result.payout);

    if (result.payout > 0) arcadeActions.credit(result.payout);
    arcadeActions.recordRound({
      slug: "golden-tiger",
      gameName: "Golden Tiger",
      bet: free ? 0 : bet,
      payout: result.payout,
      multiplier: result.payout > 0 ? result.payout / bet : 0,
      note: `${free ? "FREE SPIN · " : ""}${result.lines} linha(s) · ${result.scatterCount} cartinha(s)`,
    });

    busyRef.current = false;
    playSound(result.payout >= bet * 10 ? "bigWin" : result.payout > 0 ? "win" : "lose", soundEnabled);
    return result;
  }, [bet, soundEnabled, turbo]);

  const runBonus = useCallback(async (initial: number) => {
    if (initial <= 0 || bonusRef.current) return;
    bonusRef.current = true;
    setBonusActive(true);
    setBonusWin(0);
    setBonusSpins(initial);
    setBonusMessage(`${initial} FREE SPINS!`);
    playSound("bonus", soundEnabled);
    await wait(turbo ? 550 : 1000);
    setBonusMessage(null);

    let left = initial;
    let total = 0;
    while (left > 0) {
      setBonusSpins(left);
      const result = await spinRound(true);
      if (!result) break;
      total += result.payout;
      setBonusWin(total);
      left -= 1;
      if (result.bonusAward > 0) {
        left += result.bonusAward;
        setBonusMessage(`RETRIGGER +${result.bonusAward}`);
        playSound("bonus", soundEnabled);
        await wait(turbo ? 450 : 850);
        setBonusMessage(null);
      }
      setBonusSpins(left);
      await wait(turbo ? 90 : 220);
    }

    setBonusMessage(`BÔNUS: ${formatCoins(total)}`);
    playSound("cash", soundEnabled);
    await wait(turbo ? 650 : 1200);
    setBonusMessage(null);
    setBonusSpins(0);
    setBonusActive(false);
    bonusRef.current = false;
  }, [soundEnabled, spinRound, turbo]);

  const spin = useCallback(async () => {
    if (busyRef.current || bonusRef.current) return false;
    const result = await spinRound(false);
    if (!result) return false;
    if (result.bonusAward > 0) await runBonus(result.bonusAward);
    return true;
  }, [runBonus, spinRound]);

  const startAuto = useCallback(async () => {
    if (busyRef.current || bonusRef.current || autoLeft > 0) return;
    autoStopRef.current = false;
    for (let left = 10; left > 0; left -= 1) {
      if (autoStopRef.current) break;
      setAutoLeft(left);
      const played = await spin();
      if (!played) break;
      await wait(turbo ? 130 : 330);
    }
    setAutoLeft(0);
  }, [autoLeft, spin, turbo]);

  const changeBet = (direction: -1 | 1) => {
    if (spinning || bonusActive || autoLeft > 0) return;
    const current = Math.max(0, BET_STEPS.findIndex((value) => value === bet));
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, current + direction));
    const value = BET_STEPS[next];
    if (value !== undefined) setBet(value);
  };

  const setMaxBet = () => {
    const affordable = [...BET_STEPS].reverse().find((value) => value <= balance);
    if (affordable !== undefined && !spinning && !bonusActive) setBet(affordable);
  };

  const insufficient = bet > balance;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black sm:px-3 sm:py-2">
      <div className="relative mx-auto aspect-[940/1672] w-full max-w-[430px] overflow-hidden bg-[#240003] shadow-[0_0_90px_rgba(0,0,0,.96)] sm:rounded-[22px]">
        {src ? (
          <img src={src} alt="Golden Tiger" draggable={false} className="absolute inset-0 size-full select-none object-fill" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#260003] p-8 text-center font-bold text-yellow-100">
            {failed ? "Falha ao carregar a arte do Golden Tiger." : "Carregando Golden Tiger…"}
          </div>
        )}

        <Link to="/" aria-label="Voltar ao lobby" className="absolute left-[1.2%] top-[.8%] z-50 grid size-[8.8%] place-items-center rounded-full bg-black/10 text-transparent">
          <ArrowLeft className="size-4 opacity-0" />
        </Link>
        <button type="button" onClick={() => arcadeActions.toggleSound()} aria-label={soundEnabled ? "Desativar som" : "Ativar som"} className="absolute right-[9.3%] top-[.8%] z-50 size-[8.8%] rounded-full bg-transparent">
          {soundEnabled ? <Volume2 className="mx-auto size-4 opacity-0" /> : <VolumeX className="mx-auto size-4 opacity-0" />}
        </button>

        {src && (
          <div className="absolute left-[6.7%] top-[32.53%] z-20 grid h-[31.4%] w-[85.1%] grid-cols-5 grid-rows-3 overflow-hidden">
            {grid.map((symbol, index) => {
              const column = index % 5;
              const isRolling = spinning && column >= stoppedColumns;
              const isLanding = spinning && landingColumn === column;
              const isAnticipating = spinning && anticipation > 0 && column >= stoppedColumns;
              return (
                <div
                  key={index}
                  className={cn(
                    "relative overflow-hidden border-[1px] border-[#f8bd35]/45 bg-[#4b0710]",
                    isRolling && "gt-ref-spinning",
                    isLanding && "gt-ref-land",
                    isAnticipating && "gt-ref-anticipate",
                    !spinning && scatters.has(index) && "gt-ref-scatter",
                    !spinning && winning.has(index) && "gt-ref-win",
                  )}
                >
                  <ReferenceSymbol id={symbol} src={src} />
                </div>
              );
            })}
          </div>
        )}

        <div className="absolute left-[18%] top-[63.7%] z-35 flex h-[7.2%] w-[69%] items-center justify-center rounded-[28px] border-2 border-[#ffc52b] bg-[linear-gradient(180deg,rgba(122,0,7,.97),rgba(58,0,4,.98))] px-4 text-center shadow-[0_0_22px_rgba(255,67,0,.45)]">
          <div>
            <p className="font-serif text-[clamp(.72rem,4vw,1.15rem)] font-black uppercase leading-tight text-[#ffe475] drop-shadow-[0_2px_0_#7b1500]">
              {anticipation === 2 ? "2 CARTINHAS... FALTA SÓ 1!" : anticipation === 1 ? "1 CARTINHA... AS OUTRAS FICAM MAIS TENSAS!" : bonusActive ? `FREE SPINS ${bonusSpins}` : "3 CARTINHAS ATIVAM FREE SPINS!"}
            </p>
            {bonusActive && <p className="mt-1 text-[9px] font-black text-emerald-200">GANHO NO BÔNUS {formatCoins(bonusWin)}</p>}
          </div>
        </div>

        <NumberPatch className="left-[5%] top-[79.1%] h-[3.4%] w-[25.5%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">{formatCoins(balance)}</NumberPatch>
        <NumberPatch className="left-[34.4%] top-[77.9%] h-[4.4%] w-[31.2%] text-[clamp(1rem,6vw,1.65rem)] tabular-nums text-[#ffd73f]">{formatCoins(win)}</NumberPatch>
        <NumberPatch className="left-[75%] top-[79.1%] h-[3.4%] w-[16.6%] text-[clamp(.7rem,4vw,1.08rem)] tabular-nums">{formatCoins(bet)}</NumberPatch>

        <button type="button" onClick={() => changeBet(-1)} disabled={spinning || bonusActive || autoLeft > 0} aria-label="Diminuir aposta" className="absolute left-[69%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed" />
        <button type="button" onClick={() => changeBet(1)} disabled={spinning || bonusActive || autoLeft > 0} aria-label="Aumentar aposta" className="absolute right-[2.3%] top-[78.45%] z-50 size-[6.3%] rounded-full disabled:cursor-not-allowed" />

        <button type="button" onClick={() => setTurbo((value) => !value)} aria-pressed={turbo} aria-label="Alternar turbo" className={cn("absolute left-[4.2%] top-[86.1%] z-50 h-[8.3%] w-[17.7%] rounded-[28px]", turbo && "ring-2 ring-yellow-200 shadow-[0_0_25px_#ffb000]")} />
        {autoLeft > 0 ? (
          <button type="button" onClick={() => { autoStopRef.current = true; }} aria-label="Parar auto play" className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px]"><span className="absolute right-0 top-0 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white">{autoLeft}</span></button>
        ) : (
          <button type="button" onClick={() => void startAuto()} disabled={spinning || bonusActive || insufficient || !src} aria-label="Auto play" className="absolute left-[22.4%] top-[86.1%] z-50 h-[8.3%] w-[17.8%] rounded-[28px] disabled:opacity-40" />
        )}
        <button type="button" onClick={setMaxBet} disabled={spinning || bonusActive} aria-label="Aposta máxima" className="absolute right-[4.3%] top-[86.1%] z-50 h-[8.3%] w-[25%] rounded-[28px] disabled:opacity-40" />

        <button
          type="button"
          onClick={() => void spin()}
          disabled={spinning || bonusActive || autoLeft > 0 || insufficient || !src}
          aria-label="Girar Golden Tiger"
          className={cn("gt-ref-spin-button absolute left-[34%] top-[82.7%] z-50 size-[29.5%] rounded-full disabled:cursor-not-allowed disabled:opacity-45", spinning && "scale-95")}
        />

        {bonusMessage && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
            <div className="mx-6 rounded-[30px] border-2 border-yellow-200 bg-[radial-gradient(circle_at_50%_20%,#d92b10,#760008_65%,#260002)] px-7 py-7 text-center shadow-[0_0_65px_rgba(255,152,0,.9)]">
              <p className="font-serif text-[clamp(1.8rem,10vw,3.6rem)] font-black text-[#fff2a1] drop-shadow-[0_4px_0_#8a1d00]">{bonusMessage}</p>
            </div>
          </div>
        )}

        {insufficient && !bonusActive && (
          <div className="absolute inset-x-[12%] bottom-[.8%] z-[70] rounded-xl border border-red-200/80 bg-red-950/95 px-3 py-2 text-center text-[10px] font-bold text-red-50">Saldo fictício insuficiente — recarregue moedas grátis no lobby.</div>
        )}
        <div className="absolute inset-x-0 bottom-[.15%] z-20 text-center text-[7px] font-black tracking-[.18em] text-yellow-100/75">MOEDAS FICTÍCIAS · SEM VALOR REAL</div>
      </div>
    </main>
  );
}
