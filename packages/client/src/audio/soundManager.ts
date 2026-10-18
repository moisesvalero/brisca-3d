/**
 * Minimal, warm card-room audio: brushed paper, soft felt thumps and a small
 * reverberant chime. No chiptune oscillators or square-wave fanfares.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  public enabled: boolean = true;

  private initContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);

        // Small, dark room: just enough tail to make paper feel physical.
        const impulse = this.buildImpulse(this.ctx, 1.15, 2.8);
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = impulse;
        const wet = this.ctx.createGain();
        wet.gain.value = 0.2;
        this.reverb.connect(wet);
        wet.connect(this.master);
      }
    }
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public unlock() {
    this.initContext();
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  private buildImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  private getNoise(ctx: AudioContext) {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noise = buffer;
    }
    return this.noise;
  }

  private route(node: AudioNode, wetAmount: number) {
    if (!this.ctx || !this.master) return;
    node.connect(this.master);
    if (this.reverb && wetAmount > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wetAmount;
      node.connect(send);
      send.connect(this.reverb);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    gainValue: number,
    when: number,
    glideTo?: number,
  ) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, start);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        glideTo,
        start + duration * 0.8,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    this.route(gain, 0.32);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private paper(
    duration: number,
    gainValue: number,
    frequency: number,
    q: number,
    when: number,
  ) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + when;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoise(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    this.route(gain, 0.2);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  public vibrate(pattern: number | number[]) {
    if (
      typeof window !== "undefined" &&
      "navigator" in window &&
      navigator.vibrate
    ) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors if disabled by user agent.
      }
    }
  }

  private lastHoverTime = 0;
  public playCardHover() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastHoverTime < 140) return;
    this.lastHoverTime = now;
    this.initContext();
    this.paper(0.025, 0.012, 2600, 1.4, 0.002);
  }

  public playDeal() {
    if (!this.enabled) return;
    this.initContext();
    this.paper(0.16, 0.07, 1400, 0.7, 0);
    this.tone(170, 0.18, 0.06, 0.01, 95);
  }

  public playCardDrop(isHighCard: boolean = false) {
    if (!this.enabled) return;
    this.initContext();
    this.paper(0.035, 0.06, 900, 0.8, 0);
    this.tone(isHighCard ? 150 : 110, 0.2, 0.1, 0, 62);
    this.vibrate(8);
  }

  public playPointsWin() {
    if (!this.enabled) return;
    this.initContext();
    // Soft glass chord, long tail. No fanfare.
    this.tone(523.25, 1.15, 0.07, 0);
    this.tone(783.99, 1.25, 0.05, 0.07);
    this.tone(1046.5, 1.1, 0.022, 0.14);
    this.vibrate([8, 50, 8]);
  }

  public playTrumpSwap() {
    if (!this.enabled) return;
    this.initContext();
    this.paper(0.3, 0.06, 720, 0.6, 0);
    this.tone(174.61, 0.5, 0.045, 0.02, 196);
    this.tone(261.63, 0.65, 0.025, 0.12);
    this.vibrate(10);
  }

  public playVictory() {
    if (!this.enabled) return;
    this.initContext();
    // Low, slow major chord instead of a square-wave victory loop.
    this.tone(130.81, 2.5, 0.04, 0);
    this.tone(196, 2.4, 0.03, 0.08);
    this.tone(261.63, 2.3, 0.024, 0.16);
    this.tone(329.63, 2.2, 0.016, 0.24);
    this.vibrate([10, 60, 10, 60, 16]);
  }
}

export const sounds = new SoundManager();
