import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCoins } from "@/lib/arcade/format";
import { BET_STEPS } from "@/lib/arcade/slot-configs";
import { cn } from "@/lib/utils";

interface BetControlsProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function BetControls({ value, onChange, disabled = false, className }: BetControlsProps) {
  return (
    <section
      className={cn("rounded-2xl surface-panel p-3", className)}
      aria-label="Valor da aposta fictícia"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Coins className="size-4 text-primary" aria-hidden /> Aposta fictícia
        </span>
        <strong className="font-display text-lg tabular-nums text-primary">
          {formatCoins(value)}
        </strong>
      </div>
      <div className="scroll-hide flex gap-2 overflow-x-auto pb-1">
        {BET_STEPS.map((amount) => (
          <Button
            key={amount}
            type="button"
            size="sm"
            variant={value === amount ? "gold" : "outline"}
            className="min-h-10 min-w-[4.25rem] shrink-0 rounded-xl tabular-nums"
            disabled={disabled}
            aria-pressed={value === amount}
            onClick={() => onChange(amount)}
          >
            {formatCoins(amount)}
          </Button>
        ))}
      </div>
    </section>
  );
}
