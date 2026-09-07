import React, { memo, useEffect } from "react";
import type { GoldenTigerWinTier } from "@/lib/arcade/golden-tiger/goldenTigerConfig";
import { AnimatedWinCounter } from "@/components/arcade/AnimatedWinCounter";

interface WinOverlayProps {
  tier: GoldenTigerWinTier;
  isFullGrid: boolean;
  payout: number;
  duration: number;
  onDismiss?: () => void;
}

export const GoldenTigerWinOverlay = memo(function GoldenTigerWinOverlay({
  tier,
  isFullGrid,
  payout,
  duration,
  onDismiss,
}: WinOverlayProps) {
  // Guard clauses
  if (payout <= 0 || (tier === "none" && !isFullGrid)) return null;

  const showModal = isFullGrid || tier === "big" || tier === "mega" || tier === "epic";
  if (!showModal) return null;

  const title = isFullGrid
    ? "TELA CHEIA · MULTIPLICADOR x10"
    : tier === "epic"
    ? "EPIC WIN"
    : tier === "mega"
    ? "MEGA WIN"
    : "BIG WIN";

  // Auto‑dismiss after 3 seconds (if a dismiss handler is supplied)
  useEffect(() => {
    if (onDismiss) {
      const timer = setTimeout(() => onDismiss(), 3000);
      return () => clearTimeout(timer);
    }
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4 select-none cursor-pointer"
      role="dialog"
      aria-modal="true"
    >
      {/* Close button */}
      <button
        className="absolute top-2 right-2 text-2xl text-white hover:text-yellow-300 transition-colors"
        onClick={e => { e.stopPropagation(); onDismiss?.(); }}
        aria-label="Fechar"
      >
        ✕
      </button>

      {/* Explosão de luzes neon */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="size-[300px] rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-600/30 to-pink-500/30 blur-3xl animate-pulse" />
      </div>

      {/* Caixa de celebração premium */}
      <div className="relative z-10 w-full max-w-[340px] py-6 px-4 rounded-3xl border-2 border-yellow-300 bg-gradient-to-b from-[#3b0409] via-[#200206] to-[#0d0003] shadow-[0_0_50px_rgba(234,179,8,0.7)] flex flex-col items-center text-center animate-scale-in">
        <span className="text-4xl sm:text-5xl animate-bounce mb-1">
          {isFullGrid ? "👑" : "🐯"}
        </span>
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {title}
        </h2>
        <div className="mt-3 text-3xl sm:text-4xl font-black text-yellow-300 tracking-tight tabular-nums drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]">
          <AnimatedWinCounter value={payout} duration={duration} />
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-200/80">MOEDAS</p>
        <span className="mt-4 text-[9px] font-black tracking-widest text-yellow-500/70">TOQUE PARA CONTINUAR</span>
      </div>
    </div>
  );
});
