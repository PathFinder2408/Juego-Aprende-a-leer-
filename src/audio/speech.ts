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

/**
 * Pronuncia una letra, sílaba o palabra en español (es-CL).
 * Falla en silencio si el navegador no soporta Web Speech API.
 */
export function speakText(rawText: string, options?: { rate?: number; pitch?: number }): void {
  if (!voiceEnabled) return;
  const text = rawText.trim().toLowerCase();
  if (!text) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (typeof SpeechSynthesisUtterance === 'undefined') return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = PREFERRED_LANG;
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = options?.pitch ?? 1.05;

    const voice = pickSpanishVoice(synth);
    if (voice) {
      utterance.voice = voice;
    }

    synth.speak(utterance);
  } catch {
    // Fallback silencioso: el juego nunca debe romperse si falla el audio/TTS.
  }
}

export function stopSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignorar en entornos sin soporte.
  }
}
