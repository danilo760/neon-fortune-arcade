import { Sparkles, Trophy } from "lucide-react";

import { formatCoins, formatMultiplier } from "@/lib/arcade/format";
import { cn } from "@/lib/utils";

export function WinOverlay({ payout, multiplier }: { payout: number; multiplier: number }) {
  if (payout <= 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2 rounded-2xl border border-primary/50 bg-ink/95 p-4 text-center shadow-2xl",
        "motion-safe:animate-[pop-in_420ms_ease-out]",
      )}
      role="status"
      aria-live="polite"
    >
      <Sparkles className="mx-auto mb-1 size-6 text-primary" aria-hidden />
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/80">Você ganhou</p>
      <p className="font-display text-3xl font-black text-gold-gradient">{formatCoins(payout)}</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-jade">
        <Trophy className="size-4" aria-hidden /> {formatMultiplier(multiplier)}
      </p>
    </div>
  );
}
