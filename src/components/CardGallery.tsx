import { useState } from 'react';
import { playCorrectChime, playSoftBounce } from '../audio/sfx';
import { speakText } from '../audio/speech';
import cardsData from '../data/cards.json';
import {
  formatCardDescription,
  getCardEffectivePower,
  validateCardBlank,
} from '../features/album/albumLogic';
import type { CardEntry } from '../types/game';

interface CardGalleryProps {
  capturedWordIds: string[];
  completedCardIds: string[];
  onCompleteBlank: (cardId: string) => void;
  onPracticeCard: (wordId: string) => void;
}

export function CardGallery({
  capturedWordIds,
  completedCardIds,
  onCompleteBlank,
  onPracticeCard,
}: CardGalleryProps) {
  const cards = cardsData as CardEntry[];
  const [feedbackByCard, setFeedbackByCard] = useState<Record<string, string>>({});

  const tryWordOnCard = (card: CardEntry, chosenWord: string) => {
    speakText(chosenWord);
    const evalResult = validateCardBlank(card, chosenWord);

    if (evalResult.correct) {
      playCorrectChime(2);
      onCompleteBlank(card.id);
      setFeedbackByCard((prev) => ({
        ...prev,
        [card.id]: `¡Genial! +${evalResult.bonusPower} poder`,
      }));
      window.setTimeout(() => {
        speakText(evalResult.completedSentence, { rate: 0.9 });
      }, 420);
    } else {
      playSoftBounce();
      setFeedbackByCard((prev) => ({
        ...prev,
        [card.id]: `Esa dice "${chosenWord}". ¡Prueba otra!`,
      }));
    }
  };

  return (
    <section className="cards-grid" aria-label="Colección de cartas">
      {cards.map((card) => {
        const unlocked = capturedWordIds.includes(card.wordId);
        const blankDone = completedCardIds.includes(card.id);
        const effectivePower = getCardEffectivePower(card, blankDone);
        const feedback = feedbackByCard[card.id];

        return (
          <article
            key={card.id}
            className={`tcg-card ${unlocked ? 'tcg-card--unlocked' : 'tcg-card--locked'}`}
            style={{ '--card-accent': card.accentColor } as React.CSSProperties}
          >
            <div className="tcg-card-header">
              <span className="tcg-element">{card.element}</span>
              <span className="tcg-stars">{'★'.repeat(card.stars)}</span>
            </div>

            <div className="tcg-art-frame">
              <img
                src={card.art}
                alt={unlocked ? card.creatureName : 'Criatura por descubrir'}
                className={unlocked ? 'tcg-art' : 'tcg-art tcg-art--silhouette'}
              />
              {!unlocked && <span className="tcg-lock-q">?</span>}
            </div>

            <div className="tcg-body">
              <h3>{unlocked ? card.creatureName : '???'}</h3>
              <p className="tcg-move">
                {card.moveName} · <strong>{effectivePower}</strong>
                {blankDone && ' ⚡'}
              </p>

              {unlocked ? (
                <div
                  className={`tcg-desc-box ${blankDone ? 'tcg-desc-box--done' : ''}`}
                  onDragOver={(e) => {
                    if (!blankDone) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (blankDone) return;
                    e.preventDefault();
                    const dropped = e.dataTransfer.getData('text/plain');
                    if (dropped) tryWordOnCard(card, dropped);
                  }}
                >
                  <p className="tcg-desc">{formatCardDescription(card, blankDone)}</p>
                  {!blankDone && (
                    <div className="word-chips" aria-label="Palabras flotantes">
                      {card.wordChoices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          draggable
                          className="word-chip"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', choice);
                          }}
                          onClick={() => tryWordOnCard(card, choice)}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                  {feedback && <p className="tcg-feedback">{feedback}</p>}
                </div>
              ) : (
                <p className="tcg-desc">Explora Isla Sol para conseguir esta carta.</p>
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary tcg-btn"
              onClick={() => onPracticeCard(card.wordId)}
            >
              {unlocked ? `Practicar "${card.missingWord}"` : 'Ir a capturar'}
            </button>
          </article>
        );
      })}
    </section>
  );
}
