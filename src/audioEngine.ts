/**
 * Procedural Web Audio — resume on gesture, clear cues (inspired by sonar/audio-game polish).
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private started = false;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Linear 0–1, applied to master output (not individual voices). */
  setMasterVolume(linear: number): void {
    this.ensure();
    const g = this.master;
    if (!g) return;
    const v = Math.max(0, Math.min(1, linear));
    const t = this.ctx?.currentTime ?? 0;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(v * 0.42, t + 0.05);
  }

  /** Must run after user gesture */
  async resume(): Promise<void> {
    const c = this.ensure();
    if (!c) return;
    if (c.state === "suspended") await c.resume();
    this.started = true;
  }

  get ok(): boolean {
    return this.started && this.ctx?.state === "running";
  }

  private out(): GainNode | null {
    return this.master;
  }

  /** Active sonar ping — slight stereo pan for polish */
  playPing(strength: number, pan = 0): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;

    const t = c.currentTime;
    const dur = 0.38 + strength * 0.12;
    const sweep = c.createOscillator();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(720, t);
    sweep.frequency.exponentialRampToValueAtTime(85, t + dur);

    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22 * Math.min(1.2, strength), t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const panner = c.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    sweep.connect(env);
    env.connect(panner);
    panner.connect(g);

    sweep.start(t);
    sweep.stop(t + dur);
  }

  playFootstep(quiet: boolean): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (quiet ? 0.15 : 0.35);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = quiet ? 900 : 2200;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(quiet ? 0.08 : 0.14, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f);
    f.connect(env);
    env.connect(g);
    src.start(t);
  }

  playHazard(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(env);
    env.connect(g);
    osc.start(t);
    osc.stop(t + 0.41);
  }

  playSwitch(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(520, t);
    o.frequency.setValueAtTime(780, t + 0.06);
    const env = c.createGain();
    env.gain.setValueAtTime(0.08, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(env);
    env.connect(g);
    o.start(t);
    o.stop(t + 0.13);
  }

  playWin(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t + i * 0.12);
      env.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
      o.connect(env);
      env.connect(g);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.36);
    });
  }

  playLose(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.8);
    const env = c.createGain();
    env.gain.setValueAtTime(0.15, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(env);
    env.connect(g);
    o.start(t);
    o.stop(t + 0.86);
  }

  playThrow(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const src = c.createBufferSource();
    src.buffer = buf;
    const env = c.createGain();
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(env);
    env.connect(g);
    src.start(t);
  }

  /** Double harmonic sonar — distinct from plain ping */
  playHarmonicPing(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const sweep = (freq0: number, freq1: number, delay: number, dur: number): void => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq0, t + delay);
      osc.frequency.exponentialRampToValueAtTime(freq1, t + delay + dur);
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t + delay);
      env.gain.exponentialRampToValueAtTime(0.16, t + delay + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      osc.connect(env);
      env.connect(g);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.02);
    };
    sweep(880, 110, 0, 0.34);
    sweep(1320, 165, 0.06, 0.38);
  }

  playKeyPickup(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    [784, 988, 1175].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t + i * 0.045);
      env.gain.exponentialRampToValueAtTime(0.11, t + i * 0.045 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.22);
      o.connect(env);
      env.connect(g);
      o.start(t + i * 0.045);
      o.stop(t + i * 0.045 + 0.24);
    });
  }

  /** Silence dividend — quiet heat streak refunded toward resonance */
  playSilenceBonus(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 523.25;
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 659.25;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o1.connect(env);
    o2.connect(env);
    env.connect(g);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.36);
    o2.stop(t + 0.36);
  }

  /** Exit sealed — soft refusal tone */
  playSealDenied(): void {
    const c = this.ctx;
    const g = this.out();
    if (!c || !g) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.linearRampToValueAtTime(72, t + 0.14);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.09, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(env);
    env.connect(g);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
