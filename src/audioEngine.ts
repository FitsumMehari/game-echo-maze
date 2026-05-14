/** Procedural Web Audio: no assets, separate mix controls, adaptive ambience. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ambience: GainNode | null = null;
  private drone: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private started = false;
  private mix = { master: 0.85, sfx: 0.9, ambience: 0.42 };

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

  setMasterVolume(linear: number): void {
    this.setMix(linear, this.mix.sfx, this.mix.ambience);
  }

  updateTension(heat: number, resonance: number): void {
    if (!this.ctx || !this.ambience || this.drone.length === 0) return;
    const t = this.ctx.currentTime;
    const bend = Math.max(0, Math.min(1, heat)) * 22 + Math.max(0, Math.min(100, resonance)) * 0.05;
    this.drone.forEach((o, i) => o.frequency.linearRampToValueAtTime([48, 72, 96][i]! + bend, t + 0.18));
  }

  get ok(): boolean {
    return this.started && this.ctx?.state === "running";
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

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.12, delay = 0): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const env = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    env.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterHz: number): void {
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
    env.connect(g);
    src.start(t);
  }

  playPing(strength: number, pan = 0): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const dur = 0.38 + strength * 0.12;
    const sweep = c.createOscillator();
    const env = c.createGain();
    const panner = c.createStereoPanner();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(720, t);
    sweep.frequency.exponentialRampToValueAtTime(85, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22 * Math.min(1.2, strength), t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    sweep.connect(env);
    env.connect(panner);
    panner.connect(g);
    sweep.start(t);
    sweep.stop(t + dur);
  }

  playFootstep(quiet: boolean): void { this.noise(0.05, quiet ? 0.15 : 0.35, quiet ? 900 : 2200); }
  playThrow(): void { this.noise(0.04, 0.4, 2600); }
  playHazard(): void { this.slide(140, 40, 0.4, "sawtooth", 0.2); }
  playLose(): void { this.slide(220, 55, 0.85, "triangle", 0.15); }
  playSwitch(): void { this.tone(520, 0.12, "square", 0.08); this.tone(780, 0.1, "square", 0.06, 0.055); }
  playUi(): void { this.tone(440, 0.08, "sine", 0.045); }
  playJoin(): void { [330, 495].forEach((f, i) => this.tone(f, 0.16, "sine", 0.06, i * 0.08)); }
  playFocus(): void { [932, 698, 523].forEach((f, i) => this.tone(f, 0.18, "sine", 0.055, i * 0.035)); }
  playBeacon(): void { [247, 370, 554].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.07, i * 0.06)); }
  playKeyPickup(): void { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.22, "sine", 0.11, i * 0.045)); }
  playWin(): void { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, "sine", 0.12, i * 0.1)); }
  playSilenceBonus(): void { this.tone(523.25, 0.34, "sine", 0.055); this.tone(659.25, 0.34, "sine", 0.05); }
  playSealDenied(): void { this.slide(95, 72, 0.22, "sine", 0.09); }
  playHarmonicPing(): void { this.playPing(1.1, -0.2); setTimeout(() => this.playPing(0.7, 0.22), 60); }

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
