import { env } from '../../config/env';
import { useSettings } from '../../storage/settings';

export type SoundId =
  | 'shuffle'
  | 'deal'
  | 'place'
  | 'slide'
  | 'flip'
  | 'chip'
  | 'chips'
  | 'rattle'
  | 'bowl'
  | 'tick'
  | 'win'
  | 'tap';

export const SOUND_IDS: SoundId[] = [
  'shuffle',
  'deal',
  'place',
  'slide',
  'flip',
  'chip',
  'chips',
  'rattle',
  'bowl',
  'tick',
  'win',
  'tap',
];

/** per-sound level, before the master volume */
const LEVEL: Record<SoundId, number> = {
  shuffle: 0.7,
  deal: 0.55,
  place: 0.7,
  slide: 0.45,
  flip: 0.5,
  chip: 0.6,
  chips: 0.7,
  rattle: 0.7,
  bowl: 0.6,
  tick: 0.35,
  win: 0.5,
  tap: 0.18,
};

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

interface Burst {
  at: number;
  dur: number;
  freq: number;
  q?: number;
  gain: number;
  kind?: 'bandpass' | 'lowpass' | 'highpass';
  tone?: number; // sine tone frequency instead of noise
  toneEnd?: number;
}

function layout(id: SoundId): Burst[] {
  const out: Burst[] = [];
  switch (id) {
    case 'shuffle':
      for (let i = 0; i < 16; i++)
        out.push({
          at: i * 0.04 + Math.random() * 0.02,
          dur: 0.05,
          freq: 4200,
          q: 0.8,
          gain: 0.35 + Math.random() * 0.25,
          kind: 'highpass',
        });
      break;
    case 'deal':
      out.push({ at: 0, dur: 0.05, freq: 3200, q: 1.2, gain: 0.7, kind: 'bandpass' });
      break;
    case 'place':
      out.push({ at: 0, dur: 0.07, freq: 1100, q: 0.7, gain: 0.9, kind: 'lowpass' });
      out.push({ at: 0, dur: 0.09, freq: 0, gain: 0.25, tone: 140, toneEnd: 80 });
      break;
    case 'slide':
      out.push({ at: 0, dur: 0.16, freq: 2400, q: 0.6, gain: 0.45, kind: 'bandpass' });
      break;
    case 'flip':
      out.push({ at: 0, dur: 0.04, freq: 3000, q: 1, gain: 0.6, kind: 'bandpass' });
      out.push({ at: 0.11, dur: 0.05, freq: 2200, q: 1, gain: 0.7, kind: 'bandpass' });
      break;
    case 'chip':
      out.push({ at: 0, dur: 0.03, freq: 2800, q: 2, gain: 0.8, kind: 'bandpass' });
      out.push({ at: 0, dur: 0.05, freq: 0, gain: 0.3, tone: 1900, toneEnd: 1500 });
      break;
    case 'chips':
      for (let i = 0; i < 5; i++) {
        out.push({
          at: i * 0.045 + Math.random() * 0.015,
          dur: 0.03,
          freq: 2600 + Math.random() * 500,
          q: 2,
          gain: 0.6,
          kind: 'bandpass',
        });
        out.push({
          at: i * 0.045,
          dur: 0.05,
          freq: 0,
          gain: 0.18,
          tone: 1800 + Math.random() * 300,
        });
      }
      break;
    case 'rattle':
      for (let i = 0; i < 26; i++)
        out.push({
          at: Math.random() * 1.1,
          dur: 0.03 + Math.random() * 0.03,
          freq: 1500 + Math.random() * 1800,
          q: 3,
          gain: 0.3 + Math.random() * 0.4,
          kind: 'bandpass',
        });
      break;
    case 'bowl':
      out.push({ at: 0, dur: 0.18, freq: 0, gain: 0.35, tone: 520, toneEnd: 300 });
      out.push({ at: 0, dur: 0.12, freq: 1600, q: 1, gain: 0.35, kind: 'bandpass' });
      break;
    case 'tick':
      out.push({ at: 0, dur: 0.035, freq: 0, gain: 0.5, tone: 1050 });
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        out.push({ at: i * 0.11, dur: i === 3 ? 0.55 : 0.2, freq: 0, gain: 0.35, tone: f }),
      );
      break;
    case 'tap':
      out.push({ at: 0, dur: 0.025, freq: 1800, q: 1, gain: 0.5, kind: 'bandpass' });
      break;
  }
  return out;
}

class SoundManagerImpl {
  private ctx: Ctx | null = null;
  private buffers = new Map<SoundId, AudioBuffer | null>();
  private noise: AudioBuffer | null = null;
  private loading = false;

  /** Call from a user gesture (first tap). Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.noise = noiseBuffer(this.ctx, 0.5);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      void this.preload();
    } catch {
      /* audio is optional */
    }
  }

  private async preload() {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        try {
          const res = await fetch(`${env.base}sounds/${id}.mp3`);
          if (!res.ok) throw new Error('missing');
          const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(id, buf);
        } catch {
          this.buffers.set(id, null); // use the synthesized fallback
        }
      }),
    );
  }

  hasFile(id: SoundId) {
    return !!this.buffers.get(id);
  }

  play(id: SoundId, scale = 1) {
    const { sound, volume } = useSettings.getState();
    const ctx = this.ctx;
    if (!sound || !ctx || ctx.state !== 'running') return;
    const level = Math.min(1, volume * LEVEL[id] * scale);
    try {
      const file = this.buffers.get(id);
      if (file) {
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = level;
        src.buffer = file;
        src.connect(g).connect(ctx.destination);
        src.start();
        return;
      }
      this.synth(ctx, id, level);
    } catch {
      /* ignore */
    }
  }

  private synth(ctx: Ctx, id: SoundId, level: number) {
    const t0 = ctx.currentTime + 0.005;
    for (const b of layout(id)) {
      const g = ctx.createGain();
      const start = t0 + b.at;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, b.gain * level), start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, start + b.dur);
      if (b.tone) {
        const o = ctx.createOscillator();
        o.type = id === 'win' ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(b.tone, start);
        if (b.toneEnd) o.frequency.exponentialRampToValueAtTime(b.toneEnd, start + b.dur);
        o.connect(g).connect(ctx.destination);
        o.start(start);
        o.stop(start + b.dur + 0.02);
      } else if (this.noise) {
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = b.kind ?? 'bandpass';
        f.frequency.value = b.freq;
        f.Q.value = b.q ?? 1;
        s.connect(f).connect(g).connect(ctx.destination);
        s.start(start, Math.random() * 0.3);
        s.stop(start + b.dur + 0.02);
      }
    }
  }
}

export const sound = new SoundManagerImpl();
