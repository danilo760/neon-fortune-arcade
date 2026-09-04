export type RepeatedAudioEvent = "plinkoPeg";

type GateConfig = {
  cooldownMs: number;
  maxVoices: number;
  voiceLifetimeMs: number;
};

export const REPEATED_AUDIO_CONFIG: Record<RepeatedAudioEvent, GateConfig> = {
  plinkoPeg: {
    cooldownMs: 30,
    maxVoices: 5,
    voiceLifetimeMs: 70,
  },
};

export class AudioEventGate {
  private readonly lastPlayed = new Map<RepeatedAudioEvent, number>();
  private readonly activeUntil = new Map<RepeatedAudioEvent, number[]>();

  allow(event: RepeatedAudioEvent, nowMs: number): boolean {
    const config = REPEATED_AUDIO_CONFIG[event];
    const active = (this.activeUntil.get(event) ?? []).filter((endMs) => endMs > nowMs);
    this.activeUntil.set(event, active);

    const last = this.lastPlayed.get(event);
    if (last !== undefined && nowMs - last < config.cooldownMs) return false;
    if (active.length >= config.maxVoices) return false;

    this.lastPlayed.set(event, nowMs);
    active.push(nowMs + config.voiceLifetimeMs);
    return true;
  }

  reset() {
    this.lastPlayed.clear();
    this.activeUntil.clear();
  }
}

export function simulatePlinkoPegAdmission(
  rows = 16,
  balls = 10,
  staggerMs = 88,
): { attempted: number; admitted: number } {
  const gate = new AudioEventGate();
  const events: number[] = [];

  for (let ball = 0; ball < balls; ball += 1) {
    let now = ball * staggerMs;
    for (let step = 0; step < rows; step += 1) {
      if (step % 2 === 0 || balls <= 3) events.push(now);
      now += 58 + Math.round((step / Math.max(1, rows - 1)) * 24);
    }
  }

  events.sort((a, b) => a - b);
  let admitted = 0;
  for (const eventTime of events) {
    if (gate.allow("plinkoPeg", eventTime)) admitted += 1;
  }

  return { attempted: events.length, admitted };
}
