import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bolt, Info, Menu, Minus, Plus, RotateCw, Sparkles, Volume2, VolumeX } from "lucide-react";

const BET_STEPS = [10, 50, 100, 200, 500, 1000, 5000];

const SYMBOLS = [
  { id: "ingot", label: "Lingote da Sorte", glyph: "元", tone: "gold", pay: 6 },
  { id: "envelope", label: "Envelope Imperial", glyph: "福", tone: "red", pay: 5 },
  { id: "jade", label: "Jade Celestial", glyph: "玉", tone: "jade", pay: 4 },
  { id: "flower", label: "Flor da Fortuna", glyph: "✿", tone: "rose", pay: 3 },
  { id: "tiger", label: "Tigrinho Dourado", glyph: "虎", tone: "tiger", pay: 10 },
  { id: "coins", label: "Moedas Antigas", glyph: "◎", tone: "coin", pay: 2.5 },
  { id: "a", label: "A", glyph: "A", tone: "purple", pay: 1.8 },
  { id: "k", label: "K", glyph: "K", tone: "green", pay: 1.5 },
  { id: "q", label: "Q", glyph: "Q", tone: "blue", pay: 1.2 },
];

const INITIAL_GRID = [
  SYMBOLS[0], SYMBOLS[1], SYMBOLS[2],
  SYMBOLS[3], SYMBOLS[4], SYMBOLS[5],
  SYMBOLS[6], SYMBOLS[7], SYMBOLS[8],
];

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const toneClasses = {
  gold: "from-yellow-100 via-amber-300 to-amber-700 text-amber-950",
  red: "from-red-200 via-red-500 to-red-900 text-yellow-100",
  jade: "from-emerald-100 via-emerald-400 to-emerald-900 text-emerald-950",
  rose: "from-rose-200 via-rose-400 to-red-800 text-yellow-100",
  tiger: "from-amber-100 via-orange-400 to-orange-800 text-amber-950",
  coin: "from-yellow-100 via-yellow-400 to-orange-800 text-amber-950",
  purple: "from-fuchsia-200 via-purple-500 to-violet-950 text-yellow-100",
  green: "from-emerald-200 via-green-500 to-emerald-950 text-yellow-100",
  blue: "from-cyan-200 via-blue-500 to-blue-950 text-yellow-100",
};

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function pickSymbol() {
  const roll = Math.random();
  if (roll < 0.045) return SYMBOLS[4];
  if (roll < 0.11) return SYMBOLS[0];
  if (roll < 0.19) return SYMBOLS[1];
  if (roll < 0.28) return SYMBOLS[2];
  if (roll < 0.39) return SYMBOLS[3];
  if (roll < 0.52) return SYMBOLS[5];
  if (roll < 0.68) return SYMBOLS[6];
  if (roll < 0.84) return SYMBOLS[7];
  return SYMBOLS[8];
}

function createGrid() {
  return Array.from({ length: 9 }, pickSymbol);
}

function calculateWin(grid, bet) {
  let total = 0;
  const winningIndexes = new Set();
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (grid[a].id === grid[b].id && grid[b].id === grid[c].id) {
      total += bet * grid[a].pay;
      line.forEach((index) => winningIndexes.add(index));
    }
  }
  return { amount: Math.round(total * 100) / 100, indexes: [...winningIndexes] };
}

function SymbolTile({ symbol, spinning, winning, index }) {
  return (
    <motion.div
      className="relative flex aspect-[0.95] items-center justify-center overflow-hidden border border-yellow-400/70 bg-gradient-to-b from-[#8f150d] via-[#620a08] to-[#330302] shadow-[inset_0_0_24px_rgba(0,0,0,.7)]"
      animate={
        spinning
          ? { y: [0, 22, -24, 14, -10, 0], filter: ["blur(0px)", "blur(8px)", "blur(11px)", "blur(5px)", "blur(0px)"], scaleY: [1, 1.08, 0.94, 1.04, 1] }
          : winning
            ? { scale: [1, 1.07, 1], boxShadow: ["0 0 0 rgba(255,215,90,0)", "0 0 34px rgba(255,215,90,.95)", "0 0 8px rgba(255,215,90,.25)"] }
            : { y: 0, scale: 1, filter: "blur(0px)" }
      }
      transition={spinning ? { duration: 0.34, repeat: Infinity, ease: "linear", delay: (index % 3) * 0.035 } : { duration: 0.75, repeat: winning ? Infinity : 0 }}
    >
      <div className="absolute inset-1 border border-yellow-300/30" />
      <span className="absolute left-1 top-0.5 text-[10px] text-yellow-300/80">❧</span>
      <span className="absolute right-1 top-0.5 rotate-90 text-[10px] text-yellow-300/80">❧</span>
      <motion.div
        className={`flex size-[72%] items-center justify-center rounded-[28%] bg-gradient-to-br ${toneClasses[symbol.tone]} border border-yellow-200/70 shadow-[inset_0_3px_12px_rgba(255,255,255,.35),0_8px_18px_rgba(0,0,0,.45)]`}
        animate={winning ? { rotate: [-2, 2, -2] } : {}}
        transition={{ duration: 0.3, repeat: winning ? Infinity : 0 }}
      >
        {symbol.id === "tiger" ? (
          <div className="flex size-full flex-col items-center justify-center rounded-[28%] bg-[radial-gradient(circle_at_50%_30%,#fff1a8,#ff9f1d_45%,#9a2f04)]">
            <span className="text-[clamp(1.7rem,9vw,3.5rem)]">🐯</span>
            <span className="-mt-1 rounded-full bg-red-700 px-2 py-0.5 text-[9px] font-black text-yellow-200">財</span>
          </div>
        ) : (
          <span className="font-serif text-[clamp(2rem,11vw,4rem)] font-black leading-none drop-shadow-[0_3px_0_rgba(90,35,0,.75)]">
            {symbol.glyph}
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function GoldenTigerSlot({
  initialBalance = 25680,
  onBalanceChange,
  onRound,
  soundEnabled: controlledSound,
  onSoundToggle,
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(200);
  const [isSpinning, setIsSpinning] = useState(false);
  const [grid, setGrid] = useState(INITIAL_GRID);
  const [winAmount, setWinAmount] = useState(2450);
  const [winningIndexes, setWinningIndexes] = useState([]);
  const [turbo, setTurbo] = useState(false);
  const [localSound, setLocalSound] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const autoRef = useRef(false);
  const busyRef = useRef(false);

  const soundEnabled = controlledSound ?? localSound;
  const betIndex = Math.max(0, BET_STEPS.indexOf(bet));

  const updateBalance = useCallback((next) => {
    setBalance(next);
    onBalanceChange?.(next);
  }, [onBalanceChange]);

  const playTone = useCallback((frequency, duration = 0.11, delay = 0) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {}
  }, [soundEnabled]);

  const spinOnce = useCallback(async () => {
    if (busyRef.current || bet > balance) return false;
    busyRef.current = true;
    setIsSpinning(true);
    setWinningIndexes([]);
    setWinAmount(0);
    updateBalance(balance - bet);
    playTone(190, 0.17);
    playTone(330, 0.13, 0.07);

    const duration = turbo ? 520 : 1150;
    const interval = window.setInterval(() => setGrid(createGrid()), turbo ? 55 : 85);
    await new Promise((resolve) => window.setTimeout(resolve, duration));
    window.clearInterval(interval);

    const finalGrid = createGrid();
    const result = calculateWin(finalGrid, bet);
    setGrid(finalGrid);
    setWinningIndexes(result.indexes);
    setWinAmount(result.amount);
    const nextBalance = balance - bet + result.amount;
    updateBalance(nextBalance);
    onRound?.({ bet, payout: result.amount, multiplier: result.amount > 0 ? result.amount / bet : 0 });

    if (result.amount > 0) {
      [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.2, i * 0.075));
    } else {
      playTone(160, 0.22);
    }

    setIsSpinning(false);
    busyRef.current = false;
    return true;
  }, [balance, bet, onRound, playTone, turbo, updateBalance]);

  useEffect(() => {
    autoRef.current = autoPlay;
    if (!autoPlay || isSpinning) return;
    let cancelled = false;
    const run = async () => {
      let remaining = 10;
      while (!cancelled && autoRef.current && remaining > 0) {
        setAutoLeft(remaining);
        const played = await spinOnce();
        if (!played) break;
        remaining -= 1;
        await new Promise((resolve) => window.setTimeout(resolve, turbo ? 260 : 520));
      }
      setAutoLeft(0);
      setAutoPlay(false);
    };
    void run();
    return () => { cancelled = true; };
  }, [autoPlay, isSpinning, spinOnce, turbo]);

  const changeBet = (delta) => {
    if (isSpinning) return;
    const next = Math.max(0, Math.min(BET_STEPS.length - 1, betIndex + delta));
    setBet(BET_STEPS[next]);
  };

  const toggleSound = () => {
    if (onSoundToggle) onSoundToggle();
    else setLocalSound((value) => !value);
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-slate-950 text-white shadow-[0_0_80px_rgba(0,0,0,.9)]">
      <div className="relative isolate overflow-hidden bg-[#3a0504]">
        <div className="absolute inset-0 bg-[url('/golden-tiger-base.png')] bg-cover bg-top opacity-24 blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 via-red-950/35 to-[#3a0504]" />

        <header className="relative px-3 pt-3">
          <div className="relative overflow-hidden rounded-t-[28px] border-x-2 border-t-2 border-yellow-500 bg-gradient-to-b from-[#c66b00] via-[#9d2d05] to-[#5e0906] px-4 pb-3 pt-2 shadow-[inset_0_2px_10px_rgba(255,224,128,.55),0_10px_28px_rgba(0,0,0,.5)]">
            <div className="absolute inset-x-0 top-0 h-10 bg-[radial-gradient(circle_at_50%_-20%,#fff3a1,transparent_48%)] opacity-60" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="mt-6 rounded-xl border border-yellow-400/70 bg-gradient-to-b from-red-700 to-red-950 px-3 py-2 text-center shadow-lg">
                <p className="font-serif text-[11px] font-black tracking-wide text-yellow-200">GOLDEN</p>
                <p className="font-serif text-xl font-black leading-none text-yellow-300">TIGER</p>
                <p className="mt-1 text-[8px] font-bold tracking-[0.16em] text-yellow-100/90">PRIVATE ARCADE</p>
              </div>

              <motion.div
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="relative flex size-28 items-center justify-center rounded-[42%] border-4 border-yellow-500 bg-[radial-gradient(circle_at_50%_30%,#fff1ad,#ff9b18_48%,#a53805)] shadow-[0_8px_25px_rgba(0,0,0,.45),0_0_25px_rgba(255,185,45,.35)]">
                  <span className="text-7xl">🐯</span>
                  <span className="absolute -top-3 rounded-full border border-yellow-300 bg-red-700 px-2 py-0.5 text-xs">💎</span>
                </div>
              </motion.div>

              <div className="mt-6 rounded-xl border border-yellow-400/70 bg-gradient-to-b from-emerald-800 to-emerald-950 px-3 py-2 text-center shadow-lg">
                <p className="font-serif text-[10px] font-black text-yellow-200">GRAND JACKPOT</p>
                <p className="font-serif text-base font-black leading-tight text-yellow-300">1.250.000,00</p>
              </div>
            </div>
            <div className="relative mt-16 flex items-end justify-between">
              <span className="text-4xl">🏮</span>
              <div className="rounded-full border border-yellow-400/80 bg-black/35 px-3 py-1 text-[10px] font-bold text-yellow-200">MOEDAS FICTÍCIAS</div>
              <button className="flex size-10 items-center justify-center rounded-full border border-yellow-400 bg-red-900 text-yellow-200" aria-label="Menu">
                <Menu className="size-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="relative px-3 pb-5">
          <section className="relative overflow-hidden border-x-2 border-yellow-500 bg-gradient-to-b from-[#8d100b] to-[#3c0504] p-2 shadow-[inset_0_0_30px_rgba(255,155,24,.12)]">
            <div className="grid grid-cols-3 border-2 border-yellow-500 bg-yellow-600/40 shadow-[0_0_25px_rgba(255,181,50,.3)]">
              {grid.map((symbol, index) => (
                <SymbolTile key={`${index}-${symbol.id}`} symbol={symbol} spinning={isSpinning} winning={winningIndexes.includes(index)} index={index} />
              ))}
            </div>
          </section>

          <section className="relative -mt-px grid grid-cols-[48px_1fr_48px] items-center gap-2 border-x-2 border-yellow-500 bg-gradient-to-b from-[#7a0c08] to-[#4a0706] px-2 py-2">
            <button className="flex size-11 items-center justify-center rounded-full border-2 border-yellow-500 bg-gradient-to-b from-red-600 to-red-950 text-yellow-200 shadow-lg" aria-label="Informações">
              <Info className="size-5" />
            </button>
            <motion.div
              className="rounded-[24px] border-2 border-yellow-500 bg-gradient-to-b from-emerald-700 to-emerald-950 px-4 py-2 text-center shadow-[inset_0_2px_10px_rgba(255,255,255,.12),0_7px_18px_rgba(0,0,0,.4)]"
              animate={winAmount > 0 && !isSpinning ? { scale: [1, 1.03, 1] } : { scale: 1 }}
              transition={{ duration: 0.8, repeat: winAmount > 0 && !isSpinning ? Infinity : 0 }}
            >
              <p className="font-serif text-xs font-black tracking-[0.18em] text-yellow-200">WIN</p>
              <p className="font-serif text-3xl font-black leading-none text-yellow-300 drop-shadow-[0_2px_0_#713100]">{money(winAmount)}</p>
            </motion.div>
            <button onClick={() => setTurbo((value) => !value)} className={`flex size-11 items-center justify-center rounded-full border-2 border-yellow-500 bg-gradient-to-b ${turbo ? "from-yellow-400 to-orange-700 text-black" : "from-red-600 to-red-950 text-yellow-200"} shadow-lg`} aria-label="Turbo" aria-pressed={turbo}>
              <Bolt className="size-5" />
            </button>
          </section>

          <section className="relative border-x-2 border-b-2 border-yellow-500 bg-gradient-to-b from-[#8e160d] via-[#6c0d09] to-[#3c0504] px-2 pb-4 pt-2">
            <div className="grid grid-cols-[1fr_124px_1fr] items-end gap-2">
              <div className="space-y-2">
                <div className="rounded-xl border border-yellow-500/80 bg-black/55 px-2 py-2 text-center">
                  <p className="text-[9px] font-black tracking-wider text-yellow-200">BALANCE</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-white">{money(balance)}</p>
                </div>
                <button
                  onClick={() => setAutoPlay((value) => !value)}
                  disabled={bet > balance && !autoPlay}
                  className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-yellow-500 px-2 font-serif text-xs font-black text-yellow-200 shadow-lg ${autoPlay ? "bg-emerald-800" : "bg-gradient-to-b from-red-700 to-red-950"}`}
                >
                  <RotateCw className={`size-4 ${autoPlay ? "animate-spin" : ""}`} />
                  {autoPlay ? `STOP ${autoLeft || ""}` : "AUTO PLAY"}
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                animate={!isSpinning ? { boxShadow: ["0 0 0 rgba(35,255,100,0)", "0 0 30px rgba(35,255,100,.45)", "0 0 0 rgba(35,255,100,0)"] } : { rotate: 360 }}
                transition={isSpinning ? { duration: 0.65, repeat: Infinity, ease: "linear" } : { duration: 1.8, repeat: Infinity }}
                onClick={() => void spinOnce()}
                disabled={isSpinning || autoPlay || bet > balance}
                className="relative flex aspect-square w-[124px] items-center justify-center rounded-full border-[7px] border-yellow-500 bg-[radial-gradient(circle_at_50%_35%,#64e55f,#09972e_52%,#035719)] text-yellow-200 shadow-[inset_0_5px_14px_rgba(255,255,255,.35),0_8px_25px_rgba(0,0,0,.55)] disabled:opacity-55"
                aria-label="Girar"
              >
                <RotateCw className="size-16 stroke-[2.6] drop-shadow-[0_3px_0_#604000]" />
              </motion.button>

              <div className="space-y-2">
                <div className="rounded-xl border border-yellow-500/80 bg-black/55 px-2 py-2 text-center">
                  <p className="text-[9px] font-black tracking-wider text-yellow-200">TOTAL BET</p>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <button onClick={() => changeBet(-1)} disabled={isSpinning || autoPlay} className="flex size-7 items-center justify-center rounded-full border border-yellow-500 bg-red-950 text-yellow-200"><Minus className="size-4" /></button>
                    <span className="text-sm font-bold tabular-nums text-white">{money(bet)}</span>
                    <button onClick={() => changeBet(1)} disabled={isSpinning || autoPlay} className="flex size-7 items-center justify-center rounded-full border border-yellow-500 bg-red-950 text-yellow-200"><Plus className="size-4" /></button>
                  </div>
                </div>
                <button onClick={() => setBet(BET_STEPS[BET_STEPS.length - 1])} disabled={isSpinning || autoPlay} className="min-h-12 w-full rounded-xl border-2 border-yellow-500 bg-gradient-to-b from-red-700 to-red-950 font-serif text-xs font-black text-yellow-200 shadow-lg">MAX BET</button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-yellow-500/35 bg-black/30 px-3 py-2 text-[10px] text-yellow-100/80">
              <span className="flex items-center gap-1"><Sparkles className="size-3.5 text-yellow-300" /> 8 linhas premiadas</span>
              <button onClick={toggleSound} className="flex items-center gap-1 text-yellow-200" aria-label={soundEnabled ? "Desativar som" : "Ativar som"}>
                {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                {soundEnabled ? "SOM ON" : "SOM OFF"}
              </button>
            </div>

            <AnimatePresence>
              {bet > balance && !autoPlay && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 rounded-xl border border-red-400/50 bg-red-950/80 px-3 py-2 text-center text-xs font-semibold text-red-100">
                  Saldo fictício insuficiente para esta aposta.
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>
    </div>
  );
}
