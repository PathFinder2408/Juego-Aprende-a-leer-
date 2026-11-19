export type AmbientTheme = 'lobby' | 'maze' | 'dome';

let audioCtx: AudioContext | null = null;
let sfxEnabled = true;
let musicEnabled = true;
let musicTimer: number | null = null;
let activeTheme: AmbientTheme = 'lobby';
let stepCursor = 0;

const THEME_NOTES: Record<AmbientTheme, readonly number[]> = {
  lobby: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63],
  maze: [293.66, 349.23, 440.0, 523.25, 440.0, 349.23],
  dome: [261.63, 392.0, 493.88, 587.33, 493.88, 392.0],
};

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  if (!enabled) {
    stopAmbientMusic();
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.18, gainPeak), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.03);
  } catch {
    // Fallback silencioso si el navegador bloquea AudioContext.
  }
}

export function playCorrectChime(stepIndex: number): void {
  if (!sfxEnabled) return;
  const baseFreq = 440 + stepIndex * 90;
  playTone(baseFreq, baseFreq * 1.25, 0.18, 'triangle', 0.12);
}

export function playSoftBounce(): void {
  if (!sfxEnabled) return;
  playTone(230, 170, 0.14, 'sine', 0.07);
}

export function playBubblePop(): void {
  if (!sfxEnabled) return;
  playTone(320, 540, 0.16, 'sine', 0.09);
}

export function playCaptureFanfare(): void {
  if (!sfxEnabled) return;
  playTone(523.25, 783.99, 0.35, 'triangle', 0.14);
}

export function startAmbientMusic(theme: AmbientTheme = activeTheme): void {
  activeTheme = theme;
  if (!musicEnabled || typeof window === 'undefined') return;
  if (musicTimer !== null) return;

  const scheduleNext = () => {
    if (!musicEnabled) {
      stopAmbientMusic();
      return;
    }
    const notes = THEME_NOTES[activeTheme];
    const freq = notes[stepCursor % notes.length] ?? 261.63;
    stepCursor += 1;
    // Volumen muy suave para no interferir con voz ni SFX
    playTone(freq, freq, 0.72, 'sine', 0.028);
  };

  musicTimer = window.setInterval(scheduleNext, 850);
}

export function stopAmbientMusic(): void {
  if (musicTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
