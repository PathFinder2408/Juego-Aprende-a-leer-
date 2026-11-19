import { gameBus } from '../events/bus';
import type { ArcadeHudSnapshot } from '../types/game';

interface ArcadeHudProps {
  hud: ArcadeHudSnapshot | null;
}

export function ArcadeHud({ hud }: ArcadeHudProps) {
  if (!hud) return null;

  const availableBubbles = Math.max(0, hud.maxBubbles - hud.activeBubbles);
  const frightenedSec =
    hud.frightenedRemainingMs > 0 ? Math.ceil(hud.frightenedRemainingMs / 1000) : 0;

  const togglePause = () => {
    gameBus.emit('maze:pause', !hud.paused);
  };

  return (
    <>
      <div className="arcade-hud" role="region" aria-label="Estado del laberinto">
        <div className="arcade-hud-group">
          <span
            className="arcade-pill arcade-pill--hearts"
            aria-label={`Corazones ${hud.hearts} de ${hud.maxHearts}`}
          >
            {Array.from({ length: hud.maxHearts }, (_, idx) => (
              <span key={idx} className={idx < hud.hearts ? 'heart-on' : 'heart-off'}>
                {idx < hud.hearts ? '♥' : '♡'}
              </span>
            ))}
          </span>

          {hud.hasSolarShield && (
            <span className="arcade-pill arcade-pill--shield">🛡 Escudo</span>
          )}

          {frightenedSec > 0 && (
            <span className="arcade-pill arcade-pill--orb">★ Orbe {frightenedSec}s</span>
          )}
        </div>

        <div className="arcade-hud-group">
          <span className="arcade-pill" title="Burbujas disponibles y alcance de onda">
            🫧 {availableBubbles}/{hud.maxBubbles} · Onda {hud.waveRange}
          </span>
          <span
            className={`arcade-pill ${hud.portalOpen ? 'arcade-pill--portal-open' : ''}`}
          >
            {hud.portalOpen
              ? '★ ¡Portal abierto!'
              : `Sellos ${hud.collectedSeals}/${hud.totalSeals}`}
          </span>
          <span className="arcade-pill arcade-pill--score">{hud.score} pts</span>
          <button
            type="button"
            className="arcade-pause-btn"
            onClick={togglePause}
            aria-label={hud.paused ? 'Reanudar juego' : 'Pausar juego'}
          >
            {hud.paused ? '▶ Reanudar' : '⏸ Pausa'}
          </button>
        </div>
      </div>

      {hud.paused && (
        <div className="arcade-pause-overlay" role="dialog" aria-modal="true" aria-label="Pausa">
          <div className="arcade-pause-card">
            <h2>Juego en pausa</h2>
            <p className="arcade-pause-hints">
              Mover: <strong>WASD / Flechas</strong> · Burbuja: <strong>Espacio / Enter</strong> ·
              Pausa: <strong>Esc / P</strong>
            </p>
            <button type="button" className="btn btn-cta" onClick={togglePause}>
              Reanudar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
