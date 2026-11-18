import worldData from '../data/world.json';
import type { WorldConfig } from '../types/game';

interface LobbyViewProps {
  capturedCount: number;
  totalCount: number;
  onExploreIsland: () => void;
  onQuickDome: () => void;
  onOpenCards: () => void;
}

export function LobbyView({
  capturedCount,
  totalCount,
  onExploreIsland,
  onQuickDome,
  onOpenCards,
}: LobbyViewProps) {
  const world = worldData as WorldConfig;

  return (
    <section className="lobby-stage" aria-label="Campamento principal">
      <div className="lobby-side-left">
        <div className="stat-pill">
          <span className="stat-kicker">ÁLBUM</span>
          <strong>
            {capturedCount} / {totalCount}
          </strong>
        </div>
        <div className="stat-pill">
          <span className="stat-kicker">ETAPA</span>
          <strong>Sílabas 1</strong>
        </div>
      </div>

      <div className="lobby-hero">
        <div className="lobby-aura" />
        <img src="/assets/explorer.png" alt="Explorador chibi" className="lobby-character" />
        <div className="lobby-pedestal" />
      </div>

      <div className="lobby-side-right">
        <button type="button" className="quick-tile" onClick={onQuickDome}>
          <span className="quick-badge">SOL</span>
          <span>Cúpula rápida</span>
        </button>
        <button type="button" className="quick-tile" onClick={onOpenCards}>
          <span className="quick-badge">{capturedCount}</span>
          <span>Mis Cartas</span>
        </button>
      </div>

      <div className="mission-card">
        <div>
          <span className="mission-tag">MISIÓN 1-1 · {world.name.toUpperCase()}</span>
          <p className="mission-desc">{world.subtitle}</p>
        </div>
        <button type="button" className="btn btn-cta" onClick={onExploreIsland}>
          EXPLORAR ISLA
        </button>
      </div>
    </section>
  );
}
