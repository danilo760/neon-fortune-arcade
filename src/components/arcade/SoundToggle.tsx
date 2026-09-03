import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { arcadeActions, useArcade } from "@/lib/arcade/store";
import { playSound } from "@/lib/arcade/sound";

export function SoundToggle() {
  const soundEnabled = useArcade((state) => state.soundEnabled);

  return (
    <Button
      size="icon"
      variant="ghost"
      className="min-h-11 min-w-11 rounded-full border border-border/70"
      aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
      aria-pressed={soundEnabled}
      onClick={() => {
        arcadeActions.toggleSound();
        playSound("click", !soundEnabled);
      }}
    >
      {soundEnabled ? (
        <Volume2 className="size-5 text-primary" aria-hidden />
      ) : (
        <VolumeX className="size-5 text-muted-foreground" aria-hidden />
      )}
    </Button>
  );
}
