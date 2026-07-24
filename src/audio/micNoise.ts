/** Optional mic → echo heat. Default off; requires user gesture + permission. */
export class MicNoise {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;
  private data: Uint8Array | null = null;
  enabled = false;
  level = 0;

  async enable(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AC =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      src.connect(this.analyser);
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.stream = stream;
      this.enabled = true;
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  disable(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.enabled = false;
    this.level = 0;
  }

  /** 0–1 loudness estimate for heat injection */
  sample(): number {
    if (!this.enabled || !this.analyser || !this.data) {
      this.level = 0;
      return 0;
    }
    this.analyser.getByteTimeDomainData(this.data as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length);
    this.level = Math.min(1, rms * 4.2);
    return this.level;
  }
}
