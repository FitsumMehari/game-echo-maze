/** Procedural Web Audio: mix bus, threat ducking, occlusion, headphones spatialization. */
import type { HunterKind, HunterState } from "@/core/types";
import { cellBlocks } from "@/game/collision";
import { getCell, worldToGrid, type ParsedLevel } from "@/world/level";

export type PingMaterial = "normal" | "absorb" | "decoy";

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ambience: GainNode | null = null;
  private drone: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private started = false;
  private headphones = true;
  private mix = { master: 0.85, sfx: 0.9, ambience: 0.42 };
  private hunterCooldown = 0;
  private level: ParsedLevel | null = null;
  private doorOpen = false;
  private listenerX = 0;
  private listenerZ = 0;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.ambience = this.ctx.createGain();
    this.master.gain.value = this.mix.master * 0.42;
    this.sfx.gain.value = this.mix.sfx;
    this.ambience.gain.value = this.mix.ambience * 0.34;
    this.sfx.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  async resume(): Promise<void> {
    const c = this.ensure();
    if (!c) return;
    if (c.state === "suspended") await c.resume();
    this.started = true;
    this.startAmbience();
  }

  setHeadphones(on: boolean): void {
    this.headphones = on;
  }

  setListener(x: number, z: number, level: ParsedLevel, doorOpen: boolean): void {
    this.listenerX = x;
    this.listenerZ = z;
    this.level = level;
    this.doorOpen = doorOpen;
  }

  setMix(master: number, sfx: number, ambience: number): void {
    this.mix = {
      master: Math.max(0, Math.min(1, master)),
      sfx: Math.max(0, Math.min(1, sfx)),
      ambience: Math.max(0, Math.min(1, ambience)),
    };
    if (!this.ctx) return;
    this.ramp(this.master, this.mix.master * 0.42, 0.05);
    this.ramp(this.sfx, this.mix.sfx, 0.05);
    this.ramp(this.ambience, this.mix.ambience * 0.34, 0.2);
  }

  updateTension(heat: number, resonance: number, threat = 0): void {
    if (!this.ctx || !this.ambience || this.drone.length === 0) return;
    const t = this.ctx.currentTime;
    const th = Math.max(0, Math.min(1, threat));
    const bend = Math.max(0, Math.min(1, heat)) * 22 + Math.max(0, Math.min(100, resonance)) * 0.05 + th * 18;
    this.drone.forEach((o, i) => o.frequency.linearRampToValueAtTime([48, 72, 96][i]! + bend, t + 0.18));
    const amb = this.mix.ambience * 0.34 * (1 - th * 0.55);
    this.ramp(this.ambience, amb, 0.25);
    this.hunterCooldown = Math.max(0, this.hunterCooldown - 0.016);
  }

  get ok(): boolean {
    return this.started && this.ctx?.state === "running";
  }

  dispose(): void {
    try {
      this.drone.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
        o.disconnect();
      });
      this.drone = [];
      this.lfo?.stop();
      this.lfo?.disconnect();
      this.lfo = null;
      this.sfx?.disconnect();
      this.ambience?.disconnect();
      this.master?.disconnect();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = this.sfx = this.ambience = null;
    this.started = false;
  }

  /** Wall cells between listener and source (coarse grid ray). */
  occlusionWalls(srcX: number, srcZ: number): number {
    if (!this.level) return 0;
    const a = worldToGrid(this.listenerX, this.listenerZ);
    const b = worldToGrid(srcX, srcZ);
    const steps = Math.max(1, Math.abs(b.ix - a.ix) + Math.abs(b.iz - a.iz));
    let walls = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const ix = Math.round(a.ix + (b.ix - a.ix) * t);
      const iz = Math.round(a.iz + (b.iz - a.iz) * t);
      if (cellBlocks(getCell(this.level, ix, iz), this.doorOpen)) walls += 1;
    }
    return walls;
  }

  private out(): GainNode | null {
    return this.sfx;
  }

  private ramp(g: GainNode | null, value: number, time: number): void {
    if (!this.ctx || !g) return;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(value, t + time);
  }

  private startAmbience(): void {
    const c = this.ctx;
    const g = this.ambience;
    if (!c || !g || this.drone.length > 0) return;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 1.2;
    this.lfo = c.createOscillator();
    const lfoGain = c.createGain();
    this.lfo.frequency.value = 0.055;
    lfoGain.gain.value = 90;
    this.lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    [48, 72, 96].forEach((freq, i) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = freq;
      og.gain.value = i === 0 ? 0.05 : 0.018;
      o.connect(og);
      og.connect(filter);
      o.start();
      this.drone.push(o);
    });
    filter.connect(g);
    this.lfo.start();
  }

  private panFromOffset(dx: number, dz: number): number {
    if (!this.headphones) return 0;
    const dist = Math.hypot(dx, dz) || 1;
    return Math.max(-1, Math.min(1, dx / dist));
  }

  private spatialize(env: AudioNode, dx: number, dz: number, lowpassHz = 14000): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const walls = this.occlusionWalls(this.listenerX + dx, this.listenerZ + dz);
    const occMul = Math.max(0.22, 1 - walls * 0.18);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.max(280, lowpassHz * occMul * (1 - Math.min(0.7, walls * 0.12)));
    const occ = c.createGain();
    occ.gain.value = occMul;
    env.connect(lp);
    lp.connect(occ);
    if (this.headphones && c.createPanner) {
      const p = c.createPanner();
      p.panningModel = "HRTF";
      p.distanceModel = "inverse";
      p.refDistance = 1;
      p.maxDistance = 28;
      p.positionX.value = dx;
      p.positionY.value = 0;
      p.positionZ.value = dz;
      occ.connect(p);
      p.connect(g);
    } else {
      const p = c.createStereoPanner();
      p.pan.value = this.panFromOffset(dx, dz);
      occ.connect(p);
      p.connect(g);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.12,
    delay = 0,
    dx = 0,
    dz = 0,
    lp = 12000,
  ): void {
    const c = this.ctx;
    if (!c || !this.out()) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const env = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    this.spatialize(env, dx, dz, lp);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterHz: number, dx = 0, dz = 0): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * gain;
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const env = c.createGain();
    src.buffer = buf;
    f.type = "lowpass";
    f.frequency.value = filterHz;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(env);
    this.spatialize(env, dx, dz, filterHz);
    src.start(t);
  }

  playPing(strength: number, pan = 0, material: PingMaterial = "normal"): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const dur = 0.38 + strength * 0.12;
    const sweep = c.createOscillator();
    const env = c.createGain();
    const panner = c.createStereoPanner();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    sweep.type = material === "decoy" ? "triangle" : "sine";
    const startF = material === "absorb" ? 420 : material === "decoy" ? 880 : 720;
    const endF = material === "absorb" ? 55 : material === "decoy" ? 140 : 85;
    lp.frequency.value = material === "absorb" ? 900 : material === "decoy" ? 5000 : 12000;
    sweep.frequency.setValueAtTime(startF, t);
    sweep.frequency.exponentialRampToValueAtTime(endF, t + dur);
    const g0 = material === "absorb" ? 0.12 : 0.22;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(g0 * Math.min(1.2, strength), t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    sweep.connect(env);
    env.connect(lp);
    lp.connect(panner);
    panner.connect(g);
    sweep.start(t);
    sweep.stop(t + dur);
  }

  playHunterPresence(dx: number, dz: number, state: HunterState, kind: HunterKind): void {
    if (this.hunterCooldown > 0) return;
    const dist = Math.hypot(dx, dz);
    if (dist > 14) return;
    if (state !== "chase" && state !== "search" && state !== "hear" && state !== "idle") return;
    this.hunterCooldown = state === "chase" ? 0.32 : state === "search" ? 0.55 : 0.9;
    const base = kind === "eater" ? 70 : kind === "ambusher" ? 95 : 110;
    const gain = state === "chase" ? 0.08 : state === "search" ? 0.05 : 0.028;
    const lp = state === "chase" ? 9000 : state === "search" ? 4200 : 1800;
    this.tone(base + (14 - dist) * 3, 0.12, "triangle", gain * (1 - dist / 16), 0, dx, dz, lp);
    // State footfalls
    const stepGain = state === "chase" ? 0.28 : state === "search" ? 0.16 : 0.08;
    const stepHz = state === "chase" ? 2400 : state === "search" ? 1400 : 700;
    this.noise(0.04, stepGain * (1 - dist / 18), stepHz, dx, dz);
  }

  playLoseInterest(dx: number, dz: number): void {
    this.tone(160, 0.28, "sine", 0.045, 0, dx, dz, 2000);
    this.tone(110, 0.35, "triangle", 0.03, 0.08, dx, dz, 1600);
  }

  playLandmark(kind: "drip" | "vent" | "hum", dx: number, dz: number): void {
    if (kind === "drip") this.tone(880, 0.06, "sine", 0.03, 0, dx, dz);
    else if (kind === "vent") this.noise(0.08, 0.08, 600, dx, dz);
    else this.tone(120, 0.25, "sine", 0.025, 0, dx, dz);
  }

  playFootstep(quiet: boolean): void {
    this.noise(0.05, quiet ? 0.12 : 0.32, quiet ? 800 : 2200);
  }
  playThrow(): void {
    this.noise(0.04, 0.4, 2600);
  }
  playEnemyDown(dx = 0, dz = 0): void {
    this.slide(280, 70, 0.28, "sawtooth", 0.14);
    this.noise(0.1, 0.35, 900, dx, dz);
  }
  playHazard(): void {
    this.slide(140, 40, 0.4, "sawtooth", 0.2);
  }
  playLose(): void {
    this.slide(220, 55, 0.85, "triangle", 0.15);
  }
  playSwitch(): void {
    this.tone(520, 0.12, "square", 0.08);
    this.tone(780, 0.1, "square", 0.06, 0.055);
  }
  playUi(): void {
    this.tone(440, 0.08, "sine", 0.045);
  }
  playJoin(): void {
    [330, 495].forEach((f, i) => this.tone(f, 0.16, "sine", 0.06, i * 0.08));
  }
  playFocus(): void {
    [932, 698, 523].forEach((f, i) => this.tone(f, 0.18, "sine", 0.055, i * 0.035));
  }
  playBeacon(): void {
    [247, 370, 554].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.07, i * 0.06));
  }
  playKeyPickup(): void {
    [784, 988, 1175].forEach((f, i) => this.tone(f, 0.22, "sine", 0.11, i * 0.045));
  }
  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, "sine", 0.12, i * 0.1));
  }
  playSilenceBonus(): void {
    this.tone(523.25, 0.34, "sine", 0.055);
    this.tone(659.25, 0.34, "sine", 0.05);
  }
  playSealDenied(): void {
    this.slide(95, 72, 0.22, "sine", 0.09);
  }
  playHarmonicPing(): void {
    this.playPing(1.1, -0.2);
    setTimeout(() => this.playPing(0.7, 0.22), 60);
  }

  private slide(from: number, to: number, dur: number, type: OscillatorType, gain: number): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const env = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    env.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
