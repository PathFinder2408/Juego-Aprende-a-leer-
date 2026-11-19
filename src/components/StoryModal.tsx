import { useEffect, useState } from 'react';
import { speakStoryPassage, stopSpeech } from '../audio/speech';
import type { StorySequence } from '../types/game';

interface StoryModalProps {
  sequence: StorySequence;
  onComplete: (storyId: string) => void;
}

const PORTRAIT_IMAGES: Record<string, string> = {
  explorer: '/assets/explorer.png',
  solin: '/assets/creature-solin.png',
  sapin: '/assets/creature-sapin.png',
  mumu: '/assets/creature-mumu.png',
  cangrejo: '/assets/boss-cangrejo.png',
  don_silencio: '/assets/boss-silencio.png',
};

const PORTRAIT_BADGES: Record<string, { emoji: string; accent: string }> = {
  cangrejo: { emoji: '🦀', accent: '#f97316' },
  camaleon: { emoji: '🦎', accent: '#4ade80' },
  eco: { emoji: '📣', accent: '#fb923c' },
  golem: { emoji: '🌋', accent: '#f87171' },
  esfinge: { emoji: '📜', accent: '#a78bfa' },
  don_silencio: { emoji: '🎩', accent: '#38bdf8' },
};

export function StoryModal({ sequence, onComplete }: StoryModalProps) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    setLineIndex(0);
  }, [sequence.id]);

  const currentLine = sequence.lines[lineIndex];
  const isLastLine = lineIndex >= sequence.lines.length - 1;

  useEffect(() => {
    if (!currentLine) return;
    speakStoryPassage(currentLine.text, { rate: currentLine.speechRate ?? 0.9 });
    return () => {
      stopSpeech();
    };
  }, [sequence.id, lineIndex, currentLine]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stopSpeech();
        onComplete(sequence.id);
      } else if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        if (isLastLine) {
          stopSpeech();
          onComplete(sequence.id);
        } else {
          setLineIndex((prev) => Math.min(sequence.lines.length - 1, prev + 1));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isLastLine, onComplete, sequence.id, sequence.lines.length]);

  if (!currentLine) return null;

  const portraitSrc = PORTRAIT_IMAGES[currentLine.portraitKey];
  const portraitBadge = PORTRAIT_BADGES[currentLine.portraitKey] ?? {
    emoji: '📖',
    accent: '#facc15',
  };

  const handleNext = () => {
    if (isLastLine) {
      stopSpeech();
      onComplete(sequence.id);
      return;
    }
    setLineIndex((prev) => Math.min(sequence.lines.length - 1, prev + 1));
  };

  const handleSkip = () => {
    stopSpeech();
    onComplete(sequence.id);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
    >
      <div className="story-modal">
        <header className="story-modal-header">
          <div>
            <span className="story-kicker">
              HISTORIA · {lineIndex + 1} / {sequence.lines.length}
            </span>
            <h2 id="story-modal-title">{sequence.title}</h2>
          </div>
          <button type="button" className="btn btn-secondary story-skip-btn" onClick={handleSkip}>
            Saltar
          </button>
        </header>

        <div className="story-dialogue-box">
          <div
            className="story-portrait"
            style={{ borderColor: portraitBadge.accent }}
            aria-hidden="true"
          >
            {portraitSrc ? (
              <img src={portraitSrc} alt="" />
            ) : (
              <span className="story-portrait-emoji">{portraitBadge.emoji}</span>
            )}
          </div>

          <div className="story-text-col">
            <strong className="story-speaker">{currentLine.speaker}</strong>
            <p className="story-line">{currentLine.text}</p>
          </div>
        </div>

        <footer className="story-modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => speakStoryPassage(currentLine.text, { rate: currentLine.speechRate ?? 0.9 })}
          >
            🔊 Escuchar
          </button>
          <button type="button" className="btn btn-cta" onClick={handleNext}>
            {isLastLine ? '¡Continuar!' : 'Siguiente ▶'}
          </button>
        </footer>
      </div>
    </div>
  );
}
