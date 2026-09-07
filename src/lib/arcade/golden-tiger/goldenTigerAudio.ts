import type { GoldenTigerWinTier } from "./goldenTigerConfig";

// Helper to play an audio sample from a remote URL
async function playSample(url: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    source.onended = () => ctx.close();
  } catch (e) {
    console.warn('Audio sample failed to play', e);
  }
}

export const goldenTigerAudio = {
  buttonClick(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-button-click.wav');
  },
  spinStart(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-spin-start.wav');
  },
  reelLanding(column: number, enabled: boolean) {
    if (!enabled) return;
    // Different sample per column for richer feedback
    const samples = [
      'https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-reel-stop-0.wav',
      'https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-reel-stop-1.wav',
      'https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-reel-stop-2.wav',
    ];
    playSample(samples[Math.min(2, Math.max(0, column))]);
  },
  anticipationLoop(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-anticipation.wav');
  },
  respinTrigger(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-respin-trigger.wav');
  },
  symbolLock(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-symbol-lock.wav');
  },
  respinMiss(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-respin-miss.wav');
  },
  lineHit(enabled: boolean) {
    if (!enabled) return;
    playSample('https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-line-hit.wav');
  },
  win(tier: GoldenTigerWinTier, enabled: boolean) {
    if (!enabled || tier === "none") return;

    // Map each tier to a remote sample
    const tierSamples: Record<GoldenTigerWinTier, string> = {
      none: "",
      small: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-small.wav",
      medium: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-medium.wav",
      big: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-big.wav",
      mega: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-mega.wav",
      epic: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-epic.wav",
      fullgrid: "https://cdn.jsdelivr.net/gh/kimlimjustin/free-sound@main/slot-win-fullgrid.wav",
    };

    const sample = tierSamples[tier];
    if (sample) {
      playSample(sample);
    }

    // Preserve original fanfare for big/mega/epic (optional additional effect)
    if (tier === "big" || tier === "mega" || tier === "epic") {
      const fanfare = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
      fanfare.forEach((freq, idx) => {
        playTone({
          frequency: freq,
          type: "sine",
          duration: 0.45,
          gain: 0.18,
          delay: idx * 0.06,
        });
      });
      playTone({ frequency: 98.0, type: "sine", duration: 0.6, gain: 0.3, pitchBend: -40 });
      playFilteredNoise({ duration: 0.5, filterFreq: 1200, gain: 0.15 });
    }
  },

  /** Clímax de Tela Cheia x10 */
  fullGrid(enabled: boolean) {
    if (!enabled) return;
    // Choque comemorativo épico
    playTone({ frequency: 130.81, type: "sine", duration: 1.5, gain: 0.35, pitchBend: -20 });
    const triumph = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    triumph.forEach((freq, idx) => {
      playTone({ frequency: freq, type: "triangle", duration: 0.6, gain: 0.2, delay: idx * 0.08 });
    });
    playFilteredNoise({ duration: 1.0, filterFreq: 1500, filterQ: 2, gain: 0.22 });
  },
};
