import cardsData from '../data/cards.json';
import type { CapturePayload, CardEntry } from '../types/game';

interface CaptureCardModalProps {
  capture: CapturePayload;
  primaryActionLabel?: string;
  onGoIsland: () => void;
  onGoCards: () => void;
}

export function CaptureCardModal({
  capture,
  primaryActionLabel = 'Seguir en Isla Sol',
  onGoIsland,
  onGoCards,
}: CaptureCardModalProps) {
  const card = (cardsData as CardEntry[]).find((c) => c.wordId === capture.wordId);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Carta ganada">
      <div className="capture-modal">
        <span className="mission-tag">¡NUEVA CARTA DESBLOQUEADA!</span>
        <h2>
          {capture.creatureName} · "{capture.word}"
        </h2>

        {card && (
          <div
            className="tcg-card tcg-card--unlocked capture-modal-card"
            style={{ '--card-accent': card.accentColor } as React.CSSProperties}
          >
            <div className="tcg-card-header">
              <span className="tcg-element">{card.element}</span>
              <span className="tcg-stars">{'★'.repeat(card.stars)}</span>
            </div>
            <div className="tcg-art-frame">
              <img src={card.art} alt={card.creatureName} className="tcg-art" />
            </div>
            <div className="tcg-body">
              <h3>{card.creatureName}</h3>
              <p className="tcg-move">
                {card.moveName} · <strong>{card.movePower}</strong>
              </p>
              <p className="tcg-desc">{card.descriptionTemplate.replace('___', card.missingWord)}</p>
            </div>
          </div>
        )}

        <div className="banner-actions">
          <button type="button" className="btn btn-cta" onClick={onGoIsland}>
            {primaryActionLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onGoCards}>
            Ver mis Cartas
          </button>
        </div>
      </div>
    </div>
  );
}
