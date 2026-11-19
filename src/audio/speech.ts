const PREFERRED_LANG = 'es-CL';
let voiceEnabled = true;

export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) {
    stopSpeech();
  }
}

function pickSpanishVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === 'es-cl') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    null
  );
}

function speakInternal(
  text: string,
  options?: { rate?: number; pitch?: number; onEnd?: () => void }
): void {
  if (!voiceEnabled) return;
  const clean = text.trim();
  if (!clean) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (typeof SpeechSynthesisUtterance === 'undefined') return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = PREFERRED_LANG;
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = options?.pitch ?? 1.05;

    const voice = pickSpanishVoice(synth);
    if (voice) {
      utterance.voice = voice;
    }
    if (options?.onEnd) {
      utterance.onend = options.onEnd;
    }

    synth.speak(utterance);
  } catch {
    // Fallback silencioso: el juego nunca debe romperse si falla el audio/TTS.
  }
}

/**
 * Pronuncia una letra, sílaba o palabra corta en español (es-CL).
 */
export function speakText(rawText: string, options?: { rate?: number; pitch?: number }): void {
  speakInternal(rawText.trim().toLowerCase(), options);
}

/**
 * Lee un relato u oración completa conservando puntuación para pausas naturales.
 */
export function speakStoryPassage(
  rawText: string,
  options?: { rate?: number; pitch?: number; onEnd?: () => void }
): void {
  speakInternal(rawText, {
    rate: options?.rate ?? 0.92,
    pitch: options?.pitch ?? 1.02,
    onEnd: options?.onEnd,
  });
}

export function stopSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignorar en entornos sin soporte.
  }
}
