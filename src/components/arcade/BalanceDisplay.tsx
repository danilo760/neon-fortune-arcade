import { Coins, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCoins } from "@/lib/arcade/format";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { playSound } from "@/lib/arcade/sound";
import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  compact?: boolean;
  className?: string;
}

export function BalanceDisplay({ compact = false, className }: BalanceDisplayProps) {
  const balance = useArcade((state) => state.balance);
  const soundEnabled = useArcade((state) => state.soundEnabled);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-full border border-primary/30 bg-ink/70 px-2 py-1 backdrop-blur",
        className,
      )}
    >
      <Coins className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 truncate font-display text-sm font-semibold tabular-nums text-primary sm:text-base">
        {formatCoins(balance)}
      </span>
      <Button
        size="sm"
        variant="gold"
        className="h-8 shrink-0 rounded-full px-2 sm:px-3"
        onClick={() => {
          arcadeActions.addCoins();
          playSound("cash", soundEnabled);
        }}
        aria-label="Recarregar moedas fictícias"
      >
        <Plus className="size-4" aria-hidden />
        {!compact && <span className="hidden text-xs font-semibold sm:inline">Recarregar</span>}
      </Button>
    </div>
  );
}
