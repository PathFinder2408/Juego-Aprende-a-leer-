import cardsData from '../data/cards.json';
import type { CardEntry } from '../types/game';

interface CardGalleryProps {
  capturedWordIds: string[];
  onPracticeCard: (wordId: string) => void;
}

export function CardGallery({ capturedWordIds, onPracticeCard }: CardGalleryProps) {
  const cards = cardsData as CardEntry[];

  return (
    <section className="cards-grid" aria-label="Colección de cartas">
      {cards.map((card) => {
        const unlocked = capturedWordIds.includes(card.wordId);
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
                {card.moveName} · <strong>{card.movePower}</strong>
              </p>
              <p className="tcg-desc">
                {unlocked
                  ? card.descriptionTemplate.replace('___', card.missingWord)
                  : 'Explora Isla Sol para conseguir esta carta.'}
              </p>
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
