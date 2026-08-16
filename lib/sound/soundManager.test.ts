import { describe, it, expect } from 'vitest';
import { soundManager } from './soundManager';

describe('Sound Manager (lib/sound)', () => {
  it('should toggle and report mute state properly', () => {
    expect(soundManager.getMuted()).toBe(false);
    soundManager.setMuted(true);
    expect(soundManager.getMuted()).toBe(true);
    soundManager.setMuted(false);
    expect(soundManager.getMuted()).toBe(false);
  });

  it('should safely handle play calls across all sound events', () => {
    const events = [
      'move',
      'capture',
      'castle',
      'check',
      'promote',
      'illegal',
      'gameEnd',
      'brilliant',
      'great',
      'blunder',
      'retryCorrect',
      'retryWrong',
      'analysisDone',
    ] as const;

    for (const evt of events) {
      expect(() => soundManager.play(evt)).not.toThrow();
    }
  });

  it('should safely handle unlockAudio', () => {
    expect(() => soundManager.unlockAudio()).not.toThrow();
  });
});
