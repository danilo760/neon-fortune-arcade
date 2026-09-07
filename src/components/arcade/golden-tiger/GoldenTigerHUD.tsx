import React, { memo } from "react";
import { formatCoins } from "@/lib/arcade/format";
import { AnimatedWinCounter } from "@/components/arcade/AnimatedWinCounter";

interface HUDProps {
  balance: number;
  bet: number;
  win: number;
  winDuration: number;
  isSpinning: boolean;
  isTurbo: boolean;
  autoLeft: number;
  onSpin: () => void;
  onToggleTurbo: () => void;
  onOpenAuto: () => void;
  onStopAuto: () => void;
  onChangeBet: (delta: -1 | 1) => void;
  disabled?: boolean;
}

export const GoldenTigerHUD = memo(function GoldenTigerHUD({
  balance,
  bet,
  win,
  winDuration,
  isSpinning,
  isTurbo,
  autoLeft,
  onSpin,
  onToggleTurbo,
  onOpenAuto,
  onStopAuto,
  onChangeBet,
  disabled = false,
}: HUDProps) {
  const controlsLocked = isSpinning || autoLeft > 0 || disabled;
  const cannotSpin = isSpinning || autoLeft > 0 || bet > balance;

  return (
    <div className="w-full max-w-[390px] mx-auto flex flex-col gap-2.5 px-2 select-none">
      {/* Faixa Superior de Dados: Saldo, Ganho e Aposta */}
      <div className="grid grid-cols-3 gap-2">
        {/* Saldo */}
        <div className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border border-yellow-500/30 bg-[#2b0408]/90 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)]">
          <span className="text-[9px] font-black tracking-widest text-yellow-500/80">SALDO</span>
          <span className="text-xs sm:text-sm font-black text-white tabular-nums">
            {formatCoins(balance)}
          </span>
        </div>

        {/* Ganho Central com Contador Animado */}
        <div className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl border-2 border-yellow-400 bg-gradient-to-b from-[#4a0610] to-[#1f0205] shadow-[0_0_12px_rgba(250,204,21,0.25)]">
          <span className="text-[9px] font-black tracking-widest text-amber-300">GANHO</span>
          <span className="text-sm sm:text-base font-black text-yellow-300 tabular-nums">
            <AnimatedWinCounter value={win} duration={winDuration} />
          </span>
        </div>

        {/* Aposta Atual com Botões de - e + */}
        <div className="flex flex-col items-center justify-center py-1 px-1 rounded-xl border border-yellow-500/30 bg-[#2b0408]/90 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)]">
          <span className="text-[9px] font-black tracking-widest text-yellow-500/80">APOSTA</span>
          <div className="flex items-center justify-between w-full px-1">
            <button
              type="button"
              onClick={() => onChangeBet(-1)}
              disabled={controlsLocked}
              className="size-5 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 active:scale-95 flex items-center justify-center text-xs font-black text-yellow-200 disabled:opacity-30"
              aria-label="Diminuir aposta"
            >
              -
            </button>
            <span className="text-xs sm:text-sm font-black text-white tabular-nums">
              {formatCoins(bet)}
            </span>
            <button
              type="button"
              onClick={() => onChangeBet(1)}
              disabled={controlsLocked}
              className="size-5 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 active:scale-95 flex items-center justify-center text-xs font-black text-yellow-200 disabled:opacity-30"
              aria-label="Aumentar aposta"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Faixa Inferior de Controles Ergonômicos: Turbo, Auto e Botão Principal de Spin */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {/* Botão Turbo */}
        <button
          type="button"
          onClick={onToggleTurbo}
          disabled={isSpinning}
          className={`h-12 w-20 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center active:scale-95 disabled:opacity-40 ${
            isTurbo
              ? "border-yellow-300 bg-gradient-to-b from-yellow-400 to-amber-600 text-stone-950 font-black shadow-[0_0_15px_#f59e0b]"
              : "border-yellow-500/40 bg-black/40 text-yellow-200/70 hover:bg-yellow-500/10"
          }`}
          aria-label={isTurbo ? "Desativar modo turbo" : "Ativar modo turbo"}
        >
          <span className="text-sm">⚡</span>
          <span className="text-[9px] font-black tracking-wider">
            {isTurbo ? "TURBO" : "NORMAL"}
          </span>
        </button>

        {/* Botão Principal de Spin Físico */}
        <button
          type="button"
          onClick={onSpin}
          disabled={cannotSpin}
          aria-label="Girar cilindros"
          className={`relative size-18 rounded-full border-4 border-yellow-300 bg-gradient-to-b from-[#ef4444] via-[#b91c1c] to-[#7f1d1d] shadow-[0_4px_20px_rgba(239,68,68,0.6),inset_0_2px_6px_rgba(255,255,255,0.6)] flex items-center justify-center active:scale-90 active:brightness-90 transition-transform duration-100 disabled:opacity-45 disabled:scale-95 disabled:shadow-none`}
        >
          <div className="size-14 rounded-full border border-yellow-200/50 flex items-center justify-center">
            {isSpinning ? (
              <div className="size-7 rounded-full border-3 border-yellow-200 border-t-transparent animate-spin" />
            ) : (
              <span className="text-xl text-yellow-100 font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                ▶
              </span>
            )}
          </div>
        </button>

        {/* Botão Auto Play */}
        {autoLeft > 0 ? (
          <button
            type="button"
            onClick={onStopAuto}
            className="h-12 w-20 rounded-2xl border-2 border-emerald-400 bg-emerald-700 text-white flex flex-col items-center justify-center active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            aria-label="Parar auto play"
          >
            <span className="text-xs font-black">PARAR</span>
            <span className="text-[11px] font-black tabular-nums">{autoLeft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuto}
            disabled={controlsLocked}
            className="h-12 w-20 rounded-2xl border border-yellow-500/40 bg-black/40 text-yellow-200/80 hover:bg-yellow-500/10 flex flex-col items-center justify-center active:scale-95 disabled:opacity-40"
            aria-label="Configurar auto play"
          >
            <span className="text-sm">🔄</span>
            <span className="text-[9px] font-black tracking-wider">AUTO</span>
          </button>
        )}
      </div>

      {/* Aviso legal de moedas fictícias */}
      <div className="text-center pt-1">
        <span className="text-[7px] font-black tracking-[0.2em] text-yellow-500/60 uppercase">
          MOEDAS FICTÍCIAS · SEM VALOR REAL
        </span>
      </div>
    </div>
  );
});
