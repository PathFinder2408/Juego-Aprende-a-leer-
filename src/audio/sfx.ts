let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function playTone(freqStart: number, freqEnd: number, durationSec: number, type: OscillatorType, gainPeak: number): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // Fallback silencioso si el navegador bloquea AudioContext.
  }
}

export function playCorrectChime(stepIndex: number): void {
  const baseFreq = 440 + stepIndex * 90;
  playTone(baseFreq, baseFreq * 1.25, 0.18, 'triangle', 0.14);
}

export function playSoftBounce(): void {
  playTone(230, 170, 0.14, 'sine', 0.08);
}

export function playCaptureFanfare(): void {
  playTone(523.25, 783.99, 0.35, 'triangle', 0.16);
}
