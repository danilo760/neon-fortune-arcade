import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export function FictionalNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-ink/60 px-3 py-1.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary/90",
        className,
      )}
    >
      <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
      <span>Moedas fictícias — sem valor real</span>
    </p>
  );
}
