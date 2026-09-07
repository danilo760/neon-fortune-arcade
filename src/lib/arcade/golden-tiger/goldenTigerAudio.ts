import type { GoldenTigerWinTier } from "./goldenTigerConfig";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* ignora se autoplay ainda bloqueado */
    });
  }
  return audioCtx;
}

/** Cria um envelope ADSR simples */
function playTone({
  frequency,
  type = "sine",
  duration = 0.2,
  gain = 0.15,
  pitchBend = 0,
  detune = 0,
  delay = 0,
}: {
  frequency: number;
  type?: OscillatorType;
  duration?: number;
  gain?: number;
  pitchBend?: number;
  detune?: number;
  delay?: number;
}) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (pitchBend !== 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + pitchBend), now + duration);
  }
  if (detune !== 0) {
    osc.detune.setValueAtTime(detune, now);
  }

  // Envelope rápido: ataque de 8ms, decay suave
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

/** Reproduz ruído filtrado (para impactos, rugido e vento) */
function playFilteredNoise({
  duration,
  filterFreq,
  filterQ = 2,
  gain = 0.1,
  rampDown = true,
  delay = 0,
}: {
  duration: number;
  filterFreq: number;
  filterQ?: number;
  gain?: number;
  rampDown?: boolean;
  delay?: number;
}) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + delay);
  filter.Q.setValueAtTime(filterQ, ctx.currentTime + delay);

  const amp = ctx.createGain();
  const now = ctx.currentTime + delay;
  amp.gain.setValueAtTime(gain, now);
  if (rampDown) {
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  noise.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);

  noise.start(now);
}

export const goldenTigerAudio = {
  /** Clique tátil do botão */
  buttonClick(enabled: boolean) {
    if (!enabled) return;
    playTone({ frequency: 580, type: "triangle", duration: 0.04, gain: 0.12, pitchBend: -220 });
  },

  /** Início do giro com harpa pentatônica oriental ascendente */
  spinStart(enabled: boolean) {
    if (!enabled) return;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      playTone({
        frequency: freq,
        type: "triangle",
        duration: 0.14,
        gain: 0.1,
        delay: idx * 0.035,
      });
    });
    // Ruído sutil de início de engate
    playFilteredNoise({ duration: 0.12, filterFreq: 450, gain: 0.05 });
  },

  /** Parada física de cada coluna (0, 1, 2) com escalonamento de afinação */
  reelLanding(column: number, enabled: boolean) {
    if (!enabled) return;
    const baseFreqs = [196.0, 261.63, 392.0]; // G3, C4, G4
    const freq = baseFreqs[Math.min(2, Math.max(0, column))] ?? 261.63;

    // Batida percussiva de madeira/metal oco
    playTone({ frequency: freq, type: "sine", duration: 0.12, gain: 0.22, pitchBend: -70 });
    playTone({ frequency: freq * 2.14, type: "triangle", duration: 0.08, gain: 0.08, pitchBend: -40 });
    // Estalo de transiente
    playFilteredNoise({ duration: 0.035, filterFreq: 1800, filterQ: 4, gain: 0.14 });
  },

  /** Tensão no terceiro rolo quando há antecipação de bônus ou grande vitória */
  anticipationLoop(enabled: boolean) {
    if (!enabled) return;
    playTone({ frequency: 659.25, type: "sine", duration: 0.35, gain: 0.14, detune: 10 });
    playTone({ frequency: 783.99, type: "triangle", duration: 0.25, gain: 0.08, delay: 0.08 });
  },

  /** Ativação do Tigre da Sorte: gongo oriental com rugido sintetizado de energia */
  respinTrigger(enabled: boolean) {
    if (!enabled) return;
    // Gongo profundo ressonante
    playTone({ frequency: 130.81, type: "sine", duration: 1.2, gain: 0.28, pitchBend: -30 });
    playTone({ frequency: 196.0, type: "triangle", duration: 0.9, gain: 0.18, pitchBend: -25 });
    // Harmônico de sino dourado
    playTone({ frequency: 1046.5, type: "sine", duration: 0.6, gain: 0.15, delay: 0.05 });
    // Rugido sintetizado (ruído com modulação descendente)
    playFilteredNoise({ duration: 0.8, filterFreq: 650, filterQ: 3, gain: 0.22 });
  },

  /** Som crocante de símbolo novo travando na grade (chime de ouro) */
  symbolLock(enabled: boolean) {
    if (!enabled) return;
    playTone({ frequency: 1318.51, type: "triangle", duration: 0.15, gain: 0.2, pitchBend: 120 });
    playTone({ frequency: 2093.0, type: "sine", duration: 0.25, gain: 0.15, delay: 0.02 });
    playFilteredNoise({ duration: 0.04, filterFreq: 3200, filterQ: 5, gain: 0.1 });
  },

  /** Nenhum símbolo travou no respin */
  respinMiss(enabled: boolean) {
    if (!enabled) return;
    playTone({ frequency: 220, type: "sine", duration: 0.15, gain: 0.08, pitchBend: -80 });
  },

  /** Iluminação de linha vencedora */
  lineHit(enabled: boolean) {
    if (!enabled) return;
    playTone({ frequency: 523.25, type: "sine", duration: 0.18, gain: 0.15 });
    playTone({ frequency: 659.25, type: "triangle", duration: 0.18, gain: 0.12, delay: 0.04 });
  },

  /** Comemoração de vitória escalonada */
  win(tier: GoldenTigerWinTier, enabled: boolean) {
    if (!enabled || tier === "none") return;

    if (tier === "small") {
      playTone({ frequency: 523.25, type: "triangle", duration: 0.2, gain: 0.15 });
      playTone({ frequency: 659.25, type: "triangle", duration: 0.25, gain: 0.15, delay: 0.08 });
      return;
    }

    if (tier === "nice") {
      const chords = [392.0, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      chords.forEach((freq, idx) => {
        playTone({ frequency: freq, type: "triangle", duration: 0.35, gain: 0.15, delay: idx * 0.07 });
      });
      return;
    }

    // Big, Mega, Epic:
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
    // Impacto de tambor comemorativo
    playTone({ frequency: 98.0, type: "sine", duration: 0.6, gain: 0.3, pitchBend: -40 });
    playFilteredNoise({ duration: 0.5, filterFreq: 1200, gain: 0.15 });
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
