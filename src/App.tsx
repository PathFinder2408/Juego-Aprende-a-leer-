import { useEffect, useState } from 'react';
import { CaptureCardModal } from './components/CaptureCardModal';
import { CardGallery } from './components/CardGallery';
import { LobbyView } from './components/LobbyView';
import { PhaserCanvas } from './components/PhaserCanvas';
import { PhysicsDebugPanel } from './components/PhysicsDebugPanel';
import { DEFAULT_PHYSICS_PARAMS } from './config/physics';
import cardsData from './data/cards.json';
import { gameBus } from './events/bus';
import { ALBUM_COMPLETION_BONUS_STARS } from './features/album/albumLogic';
import { adaptiveEngine } from './features/progression/adaptiveEngine';
import type {
  ActiveScreen,
  CapturePayload,
  CardEntry,
  PhysicsParams,
  ProgressionSnapshot,
  PuzzleStatePayload,
} from './types/game';

export function App() {
  const [screen, setScreen] = useState<ActiveScreen>('home');
  const [activeWordId, setActiveWordId] = useState<string>('sol');
  const [params, setParams] = useState<PhysicsParams>(() => ({ ...DEFAULT_PHYSICS_PARAMS }));
  const [showDebug, setShowDebug] = useState(false);
  const [puzzleState, setPuzzleState] = useState<PuzzleStatePayload | null>(null);
  const [captured, setCaptured] = useState<CapturePayload | null>(null);
  const [capturedWordIds, setCapturedWordIds] = useState<string[]>([]);
  const [completedCardIds, setCompletedCardIds] = useState<string[]>([]);
  const [progression, setProgression] = useState<ProgressionSnapshot>(() => adaptiveEngine.getSnapshot());
  const [pauseReminder, setPauseReminder] = useState(false);

  const totalCards = (cardsData as CardEntry[]).length;

  useEffect(() => {
    const startMs = Date.now();
    let reminded = false;
    const timer = window.setInterval(() => {
      if (adaptiveEngine.shouldSuggestPause(Date.now() - startMs, reminded)) {
        reminded = true;
        setPauseReminder(true);
      }
    }, 30_000);

    const unsubState = gameBus.on('puzzle:state', (state) => {
      setPuzzleState(state);
    });
    const unsubProg = gameBus.on('progression:update', (snap) => {
      setProgression(snap);
    });
    const unsubEncounter = gameBus.on('encounter:start', ({ wordId }) => {
      setCaptured(null);
      setActiveWordId(wordId);
      setScreen('antigravity');
    });
    const unsubCapture = gameBus.on('capture', (payload) => {
      setCaptured(payload);
      setCapturedWordIds((prev) => (prev.includes(payload.wordId) ? prev : [...prev, payload.wordId]));
    });
    return () => {
      window.clearInterval(timer);
      unsubState();
      unsubProg();
      unsubEncounter();
      unsubCapture();
    };
  }, []);

  const handleParamChange = (key: keyof PhysicsParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    gameBus.emit('physics:update', { [key]: value });
  };

  const handleResetParams = () => {
    const defaults = { ...DEFAULT_PHYSICS_PARAMS };
    setParams(defaults);
    gameBus.emit('physics:update', defaults);
  };

  const handleRestartPuzzle = () => {
    setCaptured(null);
    gameBus.emit('puzzle:reset');
  };

  const openAntigravity = (wordId = activeWordId) => {
    setCaptured(null);
    setActiveWordId(wordId);
    setScreen('antigravity');
  };

  const progressTokens = puzzleState
    ? puzzleState.tokens.map((token, idx) => (idx < puzzleState.collectedIndex ? token : '_')).join(' ')
    : '...';

  return (
    <div className="hud-shell">
      <header className="top-hud">
        <div className="player-chip">
          <img src="/assets/explorer.png" alt="Avatar" className="player-avatar" />
          <div>
            <div className="player-name">Explorador · Nv. {1 + capturedWordIds.length}</div>
            <div className="player-sub">
              {screen === 'antigravity'
                ? `Cúpula: ${progressTokens} · Dif. Nv.${progression.level}`
                : `Isla Sol · Dif. Nv.${progression.level}`}
            </div>
          </div>
        </div>

        <div className="currency-bar">
          <span className="currency-pill">
            ★ {capturedWordIds.length * 10 + completedCardIds.length * ALBUM_COMPLETION_BONUS_STARS}
          </span>
          {screen === 'antigravity' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleRestartPuzzle}>
                Reiniciar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDebug((prev) => !prev)}
              >
                {showDebug ? 'Ocultar debug' : 'Debug'}
              </button>
            </>
          )}
        </div>
      </header>

      {pauseReminder && (
        <section className="capture-banner" role="status">
          <strong>
            ¡Llevas {adaptiveEngine.getPauseReminderMinutes()} minutos jugando! ¿Descansamos un ratito?
          </strong>
          <button type="button" className="btn btn-primary" onClick={() => setPauseReminder(false)}>
            Seguir jugando
          </button>
        </section>
      )}

      {captured && (
        <CaptureCardModal
          capture={captured}
          onGoIsland={() => {
            setCaptured(null);
            setScreen('world');
          }}
          onGoCards={() => {
            setCaptured(null);
            setScreen('cards');
          }}
        />
      )}

      <main className="main-viewport">
        {screen === 'home' && (
          <LobbyView
            capturedCount={capturedWordIds.length}
            totalCount={totalCards}
            onExploreIsland={() => {
              setCaptured(null);
              setScreen('world');
            }}
            onQuickDome={() => openAntigravity('sol')}
            onOpenCards={() => setScreen('cards')}
          />
        )}

        {(screen === 'world' || screen === 'antigravity') && (
          <div className={screen === 'antigravity' && showDebug ? 'workspace' : 'workspace workspace--full'}>
            <div className="stage-card">
              <PhaserCanvas screen={screen} activeWordId={activeWordId} />
            </div>
            {screen === 'antigravity' && showDebug && (
              <PhysicsDebugPanel
                params={params}
                onChange={handleParamChange}
                onResetDefaults={handleResetParams}
              />
            )}
          </div>
        )}

        {screen === 'cards' && (
          <CardGallery
            capturedWordIds={capturedWordIds}
            completedCardIds={completedCardIds}
            onCompleteBlank={(cardId) =>
              setCompletedCardIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]))
            }
            onPracticeCard={(wordId) => openAntigravity(wordId)}
          />
        )}
      </main>

      <nav className="bottom-dock" aria-label="Navegación principal">
        <button
          type="button"
          className={`dock-tab ${screen === 'home' ? 'dock-tab--active' : ''}`}
          onClick={() => setScreen('home')}
        >
          Inicio
        </button>
        <button
          type="button"
          className={`dock-tab ${screen === 'world' ? 'dock-tab--active' : ''}`}
          onClick={() => {
            setCaptured(null);
            setScreen('world');
          }}
        >
          Isla Sol
        </button>
        <button
          type="button"
          className={`dock-tab ${screen === 'antigravity' ? 'dock-tab--active' : ''}`}
          onClick={() => openAntigravity(activeWordId)}
        >
          Cúpula
        </button>
        <button
          type="button"
          className={`dock-tab ${screen === 'cards' ? 'dock-tab--active' : ''}`}
          onClick={() => setScreen('cards')}
        >
          Cartas ({capturedWordIds.length}/{totalCards})
        </button>
      </nav>
    </div>
  );
}
