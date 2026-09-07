import { memo, useEffect } from "react";

import { AnimatedWinCounter } from "@/components/arcade/AnimatedWinCounter";
import type { GoldenTigerWinTier } from "@/lib/arcade/golden-tiger/goldenTigerConfig";

interface WinOverlayProps {
  tier: GoldenTigerWinTier;
  isFullGrid: boolean;
  payout: number;
  duration: number;
  onDismiss?: () => void;
}

function isLargeWin(tier: GoldenTigerWinTier) {
  return tier === "big" || tier === "mega" || tier === "epic";
}

function titleFor(tier: GoldenTigerWinTier, isFullGrid: boolean) {
  if (isFullGrid) return "TELA CHEIA · MULTIPLICADOR x10";
  if (tier === "epic") return "GANHO ÉPICO";
  if (tier === "mega") return "MEGA GANHO";
  return "GRANDE GANHO";
}

export const GoldenTigerWinOverlay = memo(function GoldenTigerWinOverlay({
  tier,
  isFullGrid,
  payout,
  duration,
  onDismiss,
}: WinOverlayProps) {
  const showModal = payout > 0 && (isFullGrid || isLargeWin(tier));

  useEffect(() => {
    if (!showModal || !onDismiss) return undefined;
    const timer = window.setTimeout(onDismiss, 3000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, showModal]);

  if (!showModal) return null;

  const title = titleFor(tier, isFullGrid);

  return (
    <div
      onClick={onDismiss}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black/78 p-4 backdrop-blur-[2px] select-none cursor-pointer animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: ${payout} moedas`}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-30 grid size-9 place-items-center rounded-full border border-yellow-300/45 bg-black/45 text-base font-black text-yellow-100 transition active:scale-95"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss?.();
        }}
        aria-label="Fechar apresentação de ganho"
      >
        ×
      </button>

      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 size-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.30)_0%,rgba(245,158,11,.12)_34%,transparent_70%)] animate-pulse" />
        <div className="absolute left-1/2 top-1/2 h-[1px] w-[90%] -translate-x-1/2 bg-gradient-to-r from-transparent via-yellow-200/80 to-transparent shadow-[0_0_18px_rgba(250,204,21,.8)]" />
        <div className="absolute left-1/2 top-1/2 h-[75%] w-[1px] -translate-y-1/2 bg-gradient-to-b from-transparent via-amber-300/60 to-transparent shadow-[0_0_14px_rgba(245,158,11,.7)]" />
      </div>

      <div className="relative z-10 flex w-full max-w-[340px] flex-col items-center rounded-[28px] border border-yellow-200/85 bg-[linear-gradient(180deg,#4b090f_0%,#230205_48%,#0c0002_100%)] px-5 py-6 text-center shadow-[0_0_52px_rgba(234,179,8,.55),inset_0_1px_0_rgba(255,255,255,.12)] animate-scale-in">
        <div
          className="mb-3 grid size-16 place-items-center rounded-full border border-yellow-200/70 bg-[radial-gradient(circle_at_35%_30%,#fff2a8_0%,#f59e0b_34%,#7c2d12_72%,#250003_100%)] shadow-[0_0_24px_rgba(250,204,21,.55)]"
          aria-hidden="true"
        >
          <span className="text-[10px] font-black tracking-[.22em] text-[#2c0700]">NEON</span>
        </div>

        <h2 className="text-xl font-black uppercase tracking-[.08em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-amber-300 to-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,.8)] sm:text-2xl">
          {title}
        </h2>

        <p className="mt-2 text-[10px] font-black uppercase tracking-[.28em] text-yellow-100/65">
          VOCÊ GANHOU
        </p>

        <div className="mt-1 text-3xl font-black tracking-tight text-yellow-200 tabular-nums drop-shadow-[0_0_14px_rgba(250,204,21,.75)] sm:text-4xl">
          <AnimatedWinCounter value={payout} duration={duration} />
        </div>

        <p className="mt-1 text-[10px] font-bold uppercase tracking-[.22em] text-amber-200/75">MOEDAS</p>
        <span className="mt-4 text-[9px] font-black tracking-[.2em] text-yellow-500/70">TOQUE PARA CONTINUAR</span>
      </div>
    </div>
  );
});
