import { useEffect, useRef, useState } from 'react';
import { ArcadeHud } from './components/ArcadeHud';
import { CampaignMapView } from './components/CampaignMapView';
import { CaptureCardModal } from './components/CaptureCardModal';
import { CardGallery } from './components/CardGallery';
import { LobbyView } from './components/LobbyView';
import { PhaserCanvas } from './components/PhaserCanvas';
import { PhysicsDebugPanel } from './components/PhysicsDebugPanel';
import { SettingsModal } from './components/SettingsModal';
import { StoryModal } from './components/StoryModal';
import { TouchControls } from './components/TouchControls';
import { setMusicEnabled, setSfxEnabled, startAmbientMusic, stopAmbientMusic } from './audio/sfx';
import { setVoiceEnabled } from './audio/speech';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from './config/accessibility';
import { DEFAULT_PHYSICS_PARAMS } from './config/physics';
import cardsData from './data/cards.json';
import storyData from './data/story.json';
import { gameBus } from './events/bus';
import { ALBUM_COMPLETION_BONUS_STARS } from './features/album/albumLogic';
import {
  getPendingIntroStoryId,
  getStageById,
  recordStageCompletion,
} from './features/campaign/campaignLogic';
import { recordChallengeCompletion } from './features/campaign/fluencyEngine';
import {
  CURRENT_SAVE_VERSION,
  loadSaveState,
  resetProgressState,
  saveGameState,
} from './features/persistence/saveStorage';
import { adaptiveEngine } from './features/progression/adaptiveEngine';
import type {
  AccessibilitySettings,
  ActiveScreen,
  ArcadeHudSnapshot,
  CampaignProgressState,
  CapturePayload,
  CardEntry,
  DomeChallengeMode,
  FluencyMetrics,
  PhysicsParams,
  ProgressionSnapshot,
  PuzzleStatePayload,
  StageConfig,
  StorySequence,
} from './types/game';

export function App() {
  const [initialSave] = useState(() => {
    const loaded = loadSaveState();
    adaptiveEngine.restoreState(loaded.progression);
    return loaded;
  });

  const [screen, setScreen] = useState<ActiveScreen>('home');
  const [activeWordId, setActiveWordId] = useState<string>('sol');
  const [activeSentenceId, setActiveSentenceId] = useState<string | undefined>(undefined);
  const [activeDomeMode, setActiveDomeMode] = useState<DomeChallengeMode>('word');
  const [activeMapId, setActiveMapId] = useState<string>(
    () => getStageById(initialSave.campaign.currentStageId)?.mapId ?? 'map-ch1-1'
  );
  const [activeStageId, setActiveStageId] = useState<string>(initialSave.campaign.currentStageId);
  const [activeStageTitle, setActiveStageTitle] = useState<string>(
    () => getStageById(initialSave.campaign.currentStageId)?.title ?? 'Orilla de Vocales'
  );
  const [activeStageWordIds, setActiveStageWordIds] = useState<string[]>(
    () => getStageById(initialSave.campaign.currentStageId)?.wordIds ?? ['sol']
  );
  const [activeStageSentenceIds, setActiveStageSentenceIds] = useState<string[]>(
    () => getStageById(initialSave.campaign.currentStageId)?.sentenceIds ?? []
  );
  const [activeBossId, setActiveBossId] = useState<string | undefined>(
    () => getStageById(initialSave.campaign.currentStageId)?.bossId
  );
  const [mazeHud, setMazeHud] = useState<ArcadeHudSnapshot | null>(null);
  const [params, setParams] = useState<PhysicsParams>(() => ({ ...DEFAULT_PHYSICS_PARAMS }));
  const [showDebug, setShowDebug] = useState(false);
  const [puzzleState, setPuzzleState] = useState<PuzzleStatePayload | null>(null);
  const [captured, setCaptured] = useState<CapturePayload | null>(null);
  const [capturedFromCampaign, setCapturedFromCampaign] = useState(false);
  const [capturedWordIds, setCapturedWordIds] = useState<string[]>(() => initialSave.capturedWordIds);
  const [completedCardIds, setCompletedCardIds] = useState<string[]>(() => initialSave.completedCardIds);
  const [campaign, setCampaign] = useState<CampaignProgressState>(() => initialSave.campaign);
  const [fluency, setFluency] = useState<FluencyMetrics>(() => initialSave.fluency);
  const [progression, setProgression] = useState<ProgressionSnapshot>(() => adaptiveEngine.getSnapshot());
  const [pauseReminder, setPauseReminder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeStory, setActiveStory] = useState<StorySequence | null>(null);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(() => ({
    ...DEFAULT_ACCESSIBILITY_SETTINGS,
    ...initialSave.accessibility,
  }));

  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const latestMazeScoreRef = useRef(0);
  const activeCampaignRunRef = useRef<{ stageId: string; mazeScore: number } | null>(null);
  const pendingLaunchStageRef = useRef<StageConfig | null>(null);
  const pendingOutroStoryIdRef = useRef<string | null>(null);

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
      activeCampaignRunRef.current = null;
      setCapturedFromCampaign(false);
      setCaptured(null);
      setActiveWordId(wordId);
      setActiveSentenceId(undefined);
      setActiveDomeMode('word');
      setScreen('antigravity');
    });
    const unsubCapture = gameBus.on('capture', (payload) => {
      setCaptured(payload);
      setCapturedWordIds((prev) => (prev.includes(payload.wordId) ? prev : [...prev, payload.wordId]));
      setFluency((prev) =>
        recordChallengeCompletion(prev, {
          mode: payload.mode ?? 'word',
          accuracyPercent: payload.accuracyPercent ?? 100,
          durationMs: payload.durationMs ?? 8000,
          tokenCount: payload.tokenCount ?? 2,
        }).metrics
      );

      const activeRun = activeCampaignRunRef.current;
      if (activeRun) {
        activeCampaignRunRef.current = null;
        setCapturedFromCampaign(true);
        const totalScore = activeRun.mazeScore + 150;
        const result = recordStageCompletion(campaignRef.current, activeRun.stageId, totalScore);
        setCampaign(result.progress);
        pendingOutroStoryIdRef.current = result.storyToTriggerId;
        gameBus.emit('stage:complete', {
          stageId: activeRun.stageId,
          score: totalScore,
          stars: result.starsEarned,
        });
      } else {
        setCapturedFromCampaign(false);
      }
    });
    const unsubMazeHud = gameBus.on('maze:hud', (snap) => {
      latestMazeScoreRef.current = snap.score;
      setMazeHud(snap);
    });
    const unsubMazePortal = gameBus.on('maze:portal', (payload) => {
      if (activeCampaignRunRef.current) {
        activeCampaignRunRef.current.mazeScore = latestMazeScoreRef.current;
      }
      setCaptured(null);
      setActiveWordId(payload.wordIds[0] ?? 'sol');
      setActiveSentenceId(payload.sentenceIds[0]);
      setActiveDomeMode(payload.mode);
      setScreen('antigravity');
    });
    return () => {
      window.clearInterval(timer);
      unsubState();
      unsubProg();
      unsubEncounter();
      unsubCapture();
      unsubMazeHud();
      unsubMazePortal();
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
    activeCampaignRunRef.current = null;
    setCapturedFromCampaign(false);
    setCaptured(null);
    setActiveWordId(wordId);
    setActiveSentenceId(undefined);
    setActiveDomeMode('word');
    setScreen('antigravity');
  };

  const launchStage = (stage: StageConfig) => {
    activeCampaignRunRef.current = { stageId: stage.id, mazeScore: 0 };
    latestMazeScoreRef.current = 0;
    setCaptured(null);
    setCapturedFromCampaign(false);
    setActiveStageId(stage.id);
    setActiveMapId(stage.mapId);
    setActiveStageTitle(stage.title);
    setActiveStageWordIds(stage.wordIds);
    setActiveStageSentenceIds(stage.sentenceIds);
    setActiveSentenceId(stage.sentenceIds[0]);
    setActiveDomeMode(stage.recommendedDomeMode);
    setActiveBossId(stage.bossId);
    setActiveWordId(stage.wordIds[0] ?? 'sol');
    setCampaign((prev) => ({
      ...prev,
      currentChapterId: stage.chapterId,
      currentStageId: stage.id,
    }));
    setScreen('maze');
  };

  const handleStartCampaignStage = (stage: StageConfig) => {
    const pendingStoryId = getPendingIntroStoryId(campaign, stage.chapterId);
    if (pendingStoryId) {
      pendingLaunchStageRef.current = stage;
      openStoryById(pendingStoryId);
      return;
    }
    launchStage(stage);
  };

  useEffect(() => {
    setVoiceEnabled(accessibility.voiceEnabled);
    setSfxEnabled(accessibility.sfxEnabled);
    const musicOn = accessibility.musicEnabled ?? true;
    setMusicEnabled(musicOn);
    if (musicOn) {
      const theme = screen === 'maze' ? 'maze' : screen === 'antigravity' ? 'dome' : 'lobby';
      startAmbientMusic(theme);
    }
    gameBus.emit('accessibility:update', accessibility);
    return () => {
      stopAmbientMusic();
    };
  }, [accessibility, screen, activeWordId]);

  const handleToggleAccessibility = (key: keyof AccessibilitySettings) => {
    setAccessibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    saveGameState({
      version: CURRENT_SAVE_VERSION,
      capturedWordIds,
      completedCardIds,
      progression: {
        level: progression.level,
        correctStreak: progression.correctStreak,
        wrongStreak: progression.wrongStreak,
      },
      accessibility,
      campaign,
      fluency,
      updatedAt: new Date().toISOString(),
    });
  }, [capturedWordIds, completedCardIds, progression, accessibility, campaign, fluency]);

  const handleResetProgress = () => {
    const nextSave = resetProgressState(accessibility);
    const nextProgression = adaptiveEngine.reset();
    activeCampaignRunRef.current = null;
    pendingLaunchStageRef.current = null;
    pendingOutroStoryIdRef.current = null;
    const firstStage = getStageById(nextSave.campaign.currentStageId);
    if (firstStage) {
      setActiveStageId(firstStage.id);
      setActiveMapId(firstStage.mapId);
      setActiveStageTitle(firstStage.title);
      setActiveStageWordIds(firstStage.wordIds);
      setActiveStageSentenceIds(firstStage.sentenceIds);
      setActiveSentenceId(firstStage.sentenceIds[0]);
      setActiveDomeMode(firstStage.recommendedDomeMode);
      setActiveBossId(firstStage.bossId);
      setActiveWordId(firstStage.wordIds[0] ?? 'sol');
    }
    setCapturedWordIds(nextSave.capturedWordIds);
    setCompletedCardIds(nextSave.completedCardIds);
    setCampaign(nextSave.campaign);
    setFluency(nextSave.fluency);
    setProgression(nextProgression);
    setCaptured(null);
    setPuzzleState(null);
    setPauseReminder(false);
    gameBus.emit('progression:update', nextProgression);
    if (screen === 'antigravity') {
      gameBus.emit('puzzle:reset');
    }
  };

  const openStoryById = (storyId: string) => {
    const seq = (storyData as StorySequence[]).find((s) => s.id === storyId);
    if (seq) {
      setActiveStory(seq);
    }
  };

  const handleCompleteStory = (storyId: string) => {
    setActiveStory(null);
    const updatedSeen = campaignRef.current.seenStoryIds.includes(storyId)
      ? campaignRef.current.seenStoryIds
      : [...campaignRef.current.seenStoryIds, storyId];

    setCampaign((prev) => ({
      ...prev,
      seenStoryIds: updatedSeen,
    }));

    const queuedStage = pendingLaunchStageRef.current;
    if (queuedStage) {
      pendingLaunchStageRef.current = null;
      launchStage(queuedStage);
      return;
    }

    if (storyId === 'story-ch6-outro' && !updatedSeen.includes('story-epilogue')) {
      openStoryById('story-epilogue');
    }
  };

  const handleCloseCaptureModal = (destination: ActiveScreen) => {
    setCaptured(null);
    setCapturedFromCampaign(false);
    setScreen(destination);

    const outroId = pendingOutroStoryIdRef.current;
    if (outroId) {
      pendingOutroStoryIdRef.current = null;
      openStoryById(outroId);
    }
  };

  const progressTokens = puzzleState
    ? puzzleState.tokens.map((token, idx) => (idx < puzzleState.collectedIndex ? token : '_')).join(' ')
    : '...';

  const shellClass = [
    'hud-shell',
    accessibility.highContrast ? 'hud-shell--high-contrast' : '',
    accessibility.reducedMotion ? 'hud-shell--reduced-motion' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <header className="top-hud">
        <div className="player-chip">
          <img src="/assets/explorer.png" alt="Avatar" className="player-avatar" />
          <div>
            <div className="player-name">Explorador · Nv. {1 + capturedWordIds.length}</div>
            <div className="player-sub">
              {screen === 'antigravity'
                ? `Cúpula: ${progressTokens} · Dif. Nv.${progression.level}`
                : screen === 'maze'
                  ? mazeHud
                    ? `${mazeHud.stageTitle} · Sellos ${mazeHud.collectedSeals}/${mazeHud.totalSeals} · ${mazeHud.portalOpen ? '¡Portal abierto!' : 'Burbujas: Espacio'}`
                    : 'Laberinto · Mueve con WASD/Flechas'
                  : `Isla Sol · Dif. Nv.${progression.level}`}
            </div>
          </div>
        </div>

        <div className="currency-bar">
          <span className="currency-pill">
            ★ {capturedWordIds.length * 10 + completedCardIds.length * ALBUM_COMPLETION_BONUS_STARS}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            Ajustes
          </button>
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

      {showSettings && (
        <SettingsModal
          settings={accessibility}
          onToggle={handleToggleAccessibility}
          onResetProgress={handleResetProgress}
          onClose={() => setShowSettings(false)}
        />
      )}

      {activeStory && (
        <StoryModal sequence={activeStory} onComplete={handleCompleteStory} />
      )}

      {captured && (
        <CaptureCardModal
          capture={captured}
          primaryActionLabel={capturedFromCampaign ? 'Volver al Mapa' : 'Seguir en Isla Sol'}
          onGoIsland={() => handleCloseCaptureModal(capturedFromCampaign ? 'campaign' : 'world')}
          onGoCards={() => handleCloseCaptureModal('cards')}
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
            onOpenCampaign={() => {
              setCaptured(null);
              setScreen('campaign');
            }}
            onQuickDome={() => openAntigravity('sol')}
            onOpenCards={() => setScreen('cards')}
            onOpenStory={() => openStoryById('story-prologue')}
          />
        )}

        {screen === 'campaign' && (
          <CampaignMapView
            progress={campaign}
            onStartStage={handleStartCampaignStage}
            onOpenStory={openStoryById}
          />
        )}

        {(screen === 'world' || screen === 'antigravity' || screen === 'maze') && (
          <div className={screen === 'antigravity' && showDebug ? 'workspace' : 'workspace workspace--full'}>
            <div className="stage-card stage-card--interactive">
              {screen === 'maze' && <ArcadeHud hud={mazeHud} />}
              <PhaserCanvas
                screen={screen}
                activeWordId={activeWordId}
                activeSentenceId={activeSentenceId}
                activeDomeMode={activeDomeMode}
                activeMapId={activeMapId}
                activeStageId={activeStageId}
                activeStageTitle={activeStageTitle}
                activeStageWordIds={activeStageWordIds}
                activeStageSentenceIds={activeStageSentenceIds}
                activeBossId={activeBossId}
                equippedCardId={campaign.equippedCardId}
              />
              {screen === 'maze' && <TouchControls />}
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
            equippedCardId={campaign.equippedCardId}
            onCompleteBlank={(cardId) =>
              setCompletedCardIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]))
            }
            onPracticeCard={(wordId) => openAntigravity(wordId)}
            onEquipCard={(cardId) =>
              setCampaign((prev) => ({
                ...prev,
                equippedCardId: cardId,
              }))
            }
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
          className={`dock-tab ${screen === 'campaign' ? 'dock-tab--active' : ''}`}
          onClick={() => {
            setCaptured(null);
            setScreen('campaign');
          }}
        >
          Campaña
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
          className={`dock-tab ${screen === 'maze' ? 'dock-tab--active' : ''}`}
          onClick={() => {
            const stage = getStageById(campaign.currentStageId);
            if (stage) {
              launchStage(stage);
            } else {
              setCaptured(null);
              setScreen('maze');
            }
          }}
        >
          Laberinto
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
