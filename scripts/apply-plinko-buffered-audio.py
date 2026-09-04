from pathlib import Path

path = Path("src/lib/arcade/sound.ts")
text = path.read_text()

text = text.replace(
'''let cachedNoiseBuffer: AudioBuffer | null = null;
const noiseFilters = new Map<number, BiquadFilterNode>();
''',
'''let cachedNoiseBuffer: AudioBuffer | null = null;
const cachedCueBuffers = new Map<string, AudioBuffer[]>();
const noiseFilters = new Map<number, BiquadFilterNode>();
''',
1,
)
text = text.replace(
'''  cachedNoiseBuffer = null;
  noiseFilters.clear();
''',
'''  cachedNoiseBuffer = null;
  cachedCueBuffers.clear();
  noiseFilters.clear();
''',
1,
)

marker = '''function tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0, endFreq?: number) {
'''
insert = '''type CachedCueName = "plinkoPeg" | "plinkoLaunch" | "plinkoBucket";

type CueTone = {
  start: number;
  end: number;
  gain: number;
  delay?: number;
  wave?: "sine" | "triangle" | "saw";
};

type CueSpec = { duration: number; tones: CueTone[] };

function waveform(kind: CueTone["wave"], phase: number) {
  const sine = Math.sin(phase);
  if (kind === "triangle") return (2 / Math.PI) * Math.asin(sine);
  if (kind === "saw") return 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + .5));
  return sine;
}

function cueSpec(name: CachedCueName, ratio: number): CueSpec {
  if (name === "plinkoPeg") {
    return {
      duration: .062,
      tones: [
        { start: 920 * ratio, end: 690 * ratio, gain: .016, wave: "triangle" },
        { start: 1380 * ratio, end: 1080 * ratio, gain: .009, delay: .006, wave: "sine" },
      ],
    };
  }
  if (name === "plinkoLaunch") {
    return {
      duration: .18,
      tones: [
        { start: 190 * ratio, end: 720 * ratio, gain: .021, wave: "saw" },
        { start: 760 * ratio, end: 1120 * ratio, gain: .019, delay: .035, wave: "sine" },
      ],
    };
  }
  return {
    duration: .15,
    tones: [
      { start: 360 * ratio, end: 520 * ratio, gain: .023, wave: "triangle" },
      { start: 720 * ratio, end: 980 * ratio, gain: .02, delay: .025, wave: "sine" },
    ],
  };
}

function makeCueBuffer(audio: AudioContext, spec: CueSpec) {
  const length = Math.max(1, Math.ceil(audio.sampleRate * spec.duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const t = index / audio.sampleRate;
    let sample = 0;
    for (const toneSpec of spec.tones) {
      const local = t - (toneSpec.delay ?? 0);
      if (local < 0) continue;
      const available = Math.max(.001, spec.duration - (toneSpec.delay ?? 0));
      const progress = Math.min(1, local / available);
      const frequency = toneSpec.start * (toneSpec.end / toneSpec.start) ** progress;
      const attack = Math.min(1, local / .008);
      const decay = (1 - progress) ** 2.25;
      sample += waveform(toneSpec.wave, 2 * Math.PI * frequency * local) * toneSpec.gain * attack * decay;
    }
    channel[index] = Math.max(-.92, Math.min(.92, sample));
  }
  return buffer;
}

function getCueBuffers(audio: AudioContext, name: CachedCueName) {
  const cached = cachedCueBuffers.get(name);
  if (cached?.[0]?.sampleRate === audio.sampleRate) return cached;
  const ratios = name === "plinkoPeg" ? [.94, .98, 1, 1.035, 1.07] : [.98, 1, 1.025];
  const buffers = ratios.map((ratio) => makeCueBuffer(audio, cueSpec(name, ratio)));
  cachedCueBuffers.set(name, buffers);
  return buffers;
}

function bufferedCue(name: CachedCueName) {
  const audio = getContext();
  if (!audio) return;
  const buffers = getCueBuffers(audio, name);
  const buffer = buffers[Math.floor(Math.random() * buffers.length)] ?? buffers[0];
  if (!buffer) return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(getMasterGain(audio));
  source.onended = () => source.disconnect();
  source.start();
}

'''
if marker not in text:
    raise SystemExit("tone marker missing")
text = text.replace(marker, insert + marker, 1)

text = text.replace(
'''    case "plinkoLaunch":
      tone(190,0.16,"sawtooth",0.028,0,720); tone(760,0.11,"sine",0.024,0.035,1120); break;
    case "plinkoPeg": {
      const variants = [0.94,0.98,1,1.035,1.07] as const;
      const ratio = variants[Math.floor(Math.random() * variants.length)] ?? 1;
      tone(920*ratio,0.044,"triangle",0.016,0,690*ratio); tone(1380*ratio,0.032,"sine",0.009,0.006,1080*ratio); break;
    }
    case "plinkoBucket":
      tone(360,0.12,"triangle",0.026,0,520); tone(720,0.13,"sine",0.023,0.025,980); break;
''',
'''    case "plinkoLaunch":
      bufferedCue("plinkoLaunch"); break;
    case "plinkoPeg":
      bufferedCue("plinkoPeg"); break;
    case "plinkoBucket":
      bufferedCue("plinkoBucket"); break;
''',
1,
)

path.write_text(text)
