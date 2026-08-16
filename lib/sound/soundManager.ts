/**
 * Sound Manager for ChessLens
 * Powered by Web Audio API for zero-latency, 100% offline, zero-asset-dependency chess sound effects.
 * Supports: move, capture, castle, check, promote, illegal, gameEnd, brilliant, great, blunder, retryCorrect, retryWrong, analysisDone.
 */

export type SoundEvent =
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'illegal'
  | 'gameEnd'
  | 'brilliant'
  | 'great'
  | 'blunder'
  | 'retryCorrect'
  | 'retryWrong'
  | 'analysisDone';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private volume = 0.7;
  private isUnlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private getDestination(ctx: AudioContext): AudioNode {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  public unlockAudio(): void {
    if (this.isUnlocked) return;
    const ctx = this.getContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else {
        this.isUnlocked = true;
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public play(event: SoundEvent): void {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      switch (event) {
        case 'move':
          this.synthesizeMove(ctx, now);
          break;
        case 'capture':
          this.synthesizeCapture(ctx, now);
          break;
        case 'castle':
          this.synthesizeCastle(ctx, now);
          break;
        case 'check':
          this.synthesizeCheck(ctx, now);
          break;
        case 'promote':
          this.synthesizePromote(ctx, now);
          break;
        case 'illegal':
          this.synthesizeIllegal(ctx, now);
          break;
        case 'gameEnd':
          this.synthesizeGameEnd(ctx, now);
          break;
        case 'brilliant':
          this.synthesizeBrilliant(ctx, now);
          break;
        case 'great':
          this.synthesizeGreat(ctx, now);
          break;
        case 'blunder':
          this.synthesizeBlunder(ctx, now);
          break;
        case 'retryCorrect':
          this.synthesizeRetryCorrect(ctx, now);
          break;
        case 'retryWrong':
          this.synthesizeRetryWrong(ctx, now);
          break;
        case 'analysisDone':
          this.synthesizeAnalysisDone(ctx, now);
          break;
      }
    } catch {
      // Audio errors should never crash the application
    }
  }

  // --- Synthesis Recipes ---

  /** Wooden piece tap on board */
  private synthesizeMove(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.05);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.getDestination(ctx));

    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Heavier impact capture sound */
  private synthesizeCapture(ctx: AudioContext, time: number): void {
    // Low body thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);

    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.getDestination(ctx));

    osc.start(time);
    osc.stop(time + 0.09);

    // High snap click
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();

    snap.type = 'square';
    snap.frequency.setValueAtTime(880, time);
    snap.frequency.exponentialRampToValueAtTime(220, time + 0.03);

    snapGain.gain.setValueAtTime(0.2, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    snap.connect(snapGain);
    snapGain.connect(this.getDestination(ctx));

    snap.start(time);
    snap.stop(time + 0.04);
  }

  /** Double wooden clack for castling */
  private synthesizeCastle(ctx: AudioContext, time: number): void {
    this.synthesizeMove(ctx, time);
    this.synthesizeMove(ctx, time + 0.08);
  }

  /** Check alert chime */
  private synthesizeCheck(ctx: AudioContext, time: number): void {
    const freqs = [587.33, 880]; // D5, A5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.04);

      gain.gain.setValueAtTime(0.3, time + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.04 + 0.18);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time + idx * 0.04);
      osc.stop(time + idx * 0.04 + 0.19);
    });
  }

  /** Promotion arpeggio */
  private synthesizePromote(ctx: AudioContext, time: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time + i * 0.04);

      gain.gain.setValueAtTime(0.25, time + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, time + i * 0.04 + 0.15);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time + i * 0.04);
      osc.stop(time + i * 0.04 + 0.16);
    });
  }

  /** Low rejection buzz for illegal moves */
  private synthesizeIllegal(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.linearRampToValueAtTime(110, time + 0.12);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this.getDestination(ctx));

    osc.start(time);
    osc.stop(time + 0.13);
  }

  /** Game end chord */
  private synthesizeGameEnd(ctx: AudioContext, time: number): void {
    const chord = [392.0, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time);
      osc.stop(time + 0.46);
    });
  }

  /** Brilliant move chime (high sparkle) */
  private synthesizeBrilliant(ctx: AudioContext, time: number): void {
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.05);

      gain.gain.setValueAtTime(0.35, time + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time + idx * 0.05);
      osc.stop(time + idx * 0.05 + 0.36);
    });
  }

  /** Great move upbeat tone */
  private synthesizeGreat(ctx: AudioContext, time: number): void {
    const notes = [523.25, 783.99, 1046.5]; // C5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.06);

      gain.gain.setValueAtTime(0.3, time + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.06 + 0.25);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time + idx * 0.06);
      osc.stop(time + idx * 0.06 + 0.26);
    });
  }

  /** Blunder low thud */
  private synthesizeBlunder(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(55, time + 0.2);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    osc.connect(gain);
    gain.connect(this.getDestination(ctx));

    osc.start(time);
    osc.stop(time + 0.21);
  }

  /** Retry mode correct move */
  private synthesizeRetryCorrect(ctx: AudioContext, time: number): void {
    this.synthesizeGreat(ctx, time);
  }

  /** Retry mode wrong move */
  private synthesizeRetryWrong(ctx: AudioContext, time: number): void {
    this.synthesizeIllegal(ctx, time);
  }

  /** Analysis complete notification */
  private synthesizeAnalysisDone(ctx: AudioContext, time: number): void {
    const notes = [440, 659.25]; // A4, E5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.08);

      gain.gain.setValueAtTime(0.2, time + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.getDestination(ctx));

      osc.start(time + idx * 0.08);
      osc.stop(time + idx * 0.08 + 0.21);
    });
  }
}

export const soundManager = new SoundManager();
