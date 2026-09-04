/**
 * Lightweight procedural WebAudio engine.
 * No commercial audio assets, no downloads, and no autoplay before interaction.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0, endFreq?: number) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4200, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter).connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration: number, gain: number, delay = 0, cutoff = 1800) {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, start);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter).connect(amp).connect(audio.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export type SoundName =
  | "spin" | "tick" | "anticipation" | "win" | "bigWin" | "lose" | "click" | "cash" | "bonus"
  | "tigerScatter" | "tigerThrow" | "tigerImpact" | "tigerBonus" | "tigerRetrigger" | "tigerMiss"
  | "olympusCluster" | "olympusFall" | "olympusCharge" | "olympusHit" | "olympusMultiplier"
  | "candyPop" | "candyBreak" | "candyBounce" | "candyBomb" | "candyExplosion" | "candyStreak"
  | "minesMetal" | "minesUnlock" | "minesCrystal" | "minesDanger" | "minesExplosion" | "minesCashout"
  | "plinkoPortal" | "plinkoLaunch" | "plinkoPeg" | "plinkoBucket" | "plinkoHigh";

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  switch (name) {
    case "spin":
      noise(0.22, 0.02, 0, 1200); tone(150, 0.2, "sawtooth", 0.035, 0, 290); tone(330, 0.12, "triangle", 0.035, 0.055, 480); break;
    case "tick":
      tone(980, 0.045, "square", 0.018, 0, 720); tone(1450, 0.035, "sine", 0.012, 0.008, 1050); break;
    case "anticipation":
      tone(132, 0.34, "sine", 0.042, 0, 168); tone(264, 0.2, "triangle", 0.028, 0.08, 352); tone(420, 0.16, "sine", 0.025, 0.18, 620); noise(0.25, 0.008, 0.08, 900); break;
    case "tigerScatter":
      tone(880, 0.16, "sine", 0.038, 0, 1320); tone(440, 0.2, "triangle", 0.025, 0.035, 660); noise(0.11, 0.006, 0.02, 2600); break;
    case "tigerThrow":
      noise(0.22, 0.012, 0, 3200); tone(220, 0.28, "sawtooth", 0.028, 0, 760); tone(660, 0.2, "triangle", 0.03, 0.08, 1180); break;
    case "tigerImpact":
      noise(0.12, 0.022, 0, 2100); tone(170, 0.16, "triangle", 0.045, 0, 105); tone(1180, 0.09, "sine", 0.022, 0.01, 780); break;
    case "tigerBonus":
      noise(0.5, 0.015, 0, 3300); tone(118, 0.7, "sine", 0.055, 0, 82); [392,523,659,784,1046,1318].forEach((f,i)=>tone(f,0.32,i%2===0?"triangle":"sine",0.058,0.09+i*0.07,f*1.06)); break;
    case "tigerRetrigger":
      [784,1046,1318,1568].forEach((f,i)=>tone(f,0.22,"sine",0.05,i*0.06,f*1.05)); tone(262,0.38,"triangle",0.03,0.04,524); break;
    case "tigerMiss":
      tone(410,0.16,"triangle",0.022,0,330); tone(290,0.2,"sine",0.018,0.08,210); break;
    case "olympusCluster":
      [330,440,554].forEach((f,i)=>tone(f,0.13,"triangle",0.03,i*0.035,f*1.08)); noise(0.12,0.009,0,2400); break;
    case "olympusFall":
      noise(0.18,0.012,0,1100); tone(250,0.16,"sine",0.022,0,170); break;
    case "olympusCharge":
      tone(96,0.52,"sine",0.045,0,150); tone(220,0.42,"sawtooth",0.028,0.05,720); noise(0.38,0.008,0.08,1500); break;
    case "olympusHit":
      noise(0.22,0.028,0,3200); tone(78,0.36,"sine",0.06,0,52); tone(1180,0.11,"square",0.025,0.01,620); break;
    case "olympusMultiplier":
      [523,784,1046].forEach((f,i)=>tone(f,0.2,"sine",0.04,i*0.055,f*1.05)); break;
    case "candyPop": {
      const v = 0.97 + Math.random() * 0.06;
      tone(620*v,0.11,"triangle",0.028,0,980*v); break;
    }
    case "candyBreak": {
      const v = 0.97 + Math.random() * 0.06;
      tone(880*v,0.14,"triangle",0.03,0,410*v); tone(1240*v,0.09,"sine",0.018,0.025,700*v); break;
    }
    case "candyBounce":
      tone(320,0.12,"triangle",0.024,0,520); break;
    case "candyBomb":
      tone(210,0.34,"sine",0.036,0,680); tone(440,0.25,"triangle",0.025,0.08,1120); break;
    case "candyExplosion":
      noise(0.2,0.02,0,2800); tone(180,0.28,"sine",0.045,0,72); tone(1320,0.13,"triangle",0.025,0.01,420); break;
    case "candyStreak":
      [520,660,820].forEach((f,i)=>tone(f,0.14,"triangle",0.024,i*0.045,f*1.2)); break;
    case "minesMetal":
      noise(0.055,0.015,0,1500); tone(210,0.09,"triangle",0.024,0,155); break;
    case "minesUnlock":
      tone(460,0.12,"square",0.018,0,640); tone(720,0.1,"sine",0.02,0.055,940); break;
    case "minesCrystal": {
      const v = 0.96 + Math.random() * 0.08;
      tone(760*v,0.18,"sine",0.035,0,1280*v); tone(1140*v,0.16,"triangle",0.022,0.04,1540*v); break;
    }
    case "minesDanger":
      tone(92,0.3,"sine",0.036,0,76); tone(184,0.24,"sawtooth",0.014,0.04,132); break;
    case "minesExplosion":
      noise(0.28,0.035,0,1900); tone(88,0.38,"sine",0.06,0,42); tone(1180,0.1,"square",0.018,0.01,420); break;
    case "minesCashout":
      [523,659,880,1174].forEach((f,i)=>tone(f,0.2,"sine",0.04,i*0.045,f*1.05)); break;
    case "plinkoPortal":
      tone(118,0.32,"sine",0.034,0,240); tone(236,0.28,"triangle",0.026,0.04,710); noise(0.22,0.007,0.06,2300); break;
    case "plinkoLaunch":
      tone(190,0.16,"sawtooth",0.028,0,720); tone(760,0.11,"sine",0.024,0.035,1120); break;
    case "plinkoPeg": {
      const variants = [0.94,0.98,1,1.035,1.07] as const;
      const ratio = variants[Math.floor(Math.random() * variants.length)] ?? 1;
      tone(920*ratio,0.044,"triangle",0.016,0,690*ratio); tone(1380*ratio,0.032,"sine",0.009,0.006,1080*ratio); break;
    }
    case "plinkoBucket":
      tone(360,0.12,"triangle",0.026,0,520); tone(720,0.13,"sine",0.023,0.025,980); break;
    case "plinkoHigh":
      noise(0.18,0.012,0,3200); [659,880,1174,1568].forEach((f,i)=>tone(f,0.21,"sine",0.04,i*0.05,f*1.08)); break;
    case "click":
      tone(560,0.055,"triangle",0.03,0,720); break;
    case "win":
      [523,659,784,1046].forEach((f,i)=>tone(f,0.2,i%2===0?"triangle":"sine",0.048,i*0.07,f*1.03)); break;
    case "bigWin":
      noise(0.3,0.012,0,3200); [392,523,659,784,1046,1318].forEach((f,i)=>tone(f,0.28,"triangle",0.055,i*0.075,f*1.08)); break;
    case "bonus":
      noise(0.42,0.014,0,3600); [392,523,659,784,1046,1318,1568].forEach((f,i)=>tone(f,0.32,i%2===0?"triangle":"sine",0.058,i*0.065,f*1.1)); tone(196,0.55,"sine",0.04,0.06,392); break;
    case "cash":
      [659,880,1174].forEach((f,i)=>tone(f,0.18,"sine",0.045,i*0.055,f*1.04)); break;
    case "lose":
      noise(0.16,0.018,0,650); tone(260,0.2,"sawtooth",0.035,0,155); tone(180,0.28,"sine",0.035,0.075,110); break;
  }
}
