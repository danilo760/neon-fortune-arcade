import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMultiplier } from "@/lib/arcade/format";
import type { SlotConfig } from "@/lib/arcade/slot-engine";

export function PaytableModal({ config }: { config: SlotConfig }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl">
          <Info className="size-4" aria-hidden /> Tabela de pagamentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border-primary/25 bg-ink">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            Tabela — {config.name}
          </DialogTitle>
          <DialogDescription>{config.paytableNote}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {config.symbols.map((symbol) => (
            <div
              key={symbol.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3"
            >
              <span className="text-3xl" aria-hidden>
                {symbol.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{symbol.label}</p>
                <p className="text-xs text-muted-foreground">
                  {symbol.linePays
                    ? Object.entries(symbol.linePays)
                        .map(([count, pay]) => `${count}× = ${formatMultiplier(pay)}`)
                        .join(" · ")
                    : (symbol.clusterTiers
                        ?.map((tier) => `${tier.min}+ = ${formatMultiplier(tier.multiplier)}`)
                        .join(" · ") ?? "Símbolo especial")}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Simulação fictícia para entretenimento. Não representa RTP certificado.
        </p>
      </DialogContent>
    </Dialog>
  );
}
