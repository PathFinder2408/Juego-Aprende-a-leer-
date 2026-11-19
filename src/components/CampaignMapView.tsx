import { useState } from 'react';
import {
  getAllChapters,
  getCampaignSummary,
  getStagesForChapter,
  isChapterCompleted,
  isChapterUnlocked,
  isStageUnlocked,
} from '../features/campaign/campaignLogic';
import type { CampaignProgressState, StageConfig } from '../types/game';

interface CampaignMapViewProps {
  progress: CampaignProgressState;
  onStartStage: (stage: StageConfig) => void;
  onOpenStory: (storyId: string) => void;
}

const BIOME_BADGE: Record<string, string> = {
  beach: '🏖️',
  jungle: '🌴',
  canyon: '🏜️',
  volcano: '🌋',
  ruins: '🏛️',
  star_dome: '✨',
};

export function CampaignMapView({
  progress,
  onStartStage,
  onOpenStory,
}: CampaignMapViewProps) {
  const chapters = getAllChapters();
  const summary = getCampaignSummary(progress);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(progress.currentChapterId);

  const activeChapter =
    chapters.find((c) => c.id === selectedChapterId) ?? chapters[0];
  const activeStages = activeChapter ? getStagesForChapter(activeChapter.id) : [];

  return (
    <section className="campaign-view" aria-label="Mapa de campaña de 6 islas">
      <header className="campaign-header">
        <div>
          <span className="mission-tag">ARCHIPIÉLAGO SILÁBICO · CAMPAÑA</span>
          <h2>6 Islas · 30 Etapas</h2>
        </div>
        <div className="campaign-stats">
          <span className="currency-pill">
            ★ {summary.earnedStars} / {summary.maxStars}
          </span>
          <span className="currency-pill">
            Etapas {summary.completedStages}/{summary.totalStages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenStory('story-prologue')}
          >
            📖 Prólogo
          </button>
        </div>
      </header>

      <div className="campaign-islands-grid" role="list" aria-label="Islas del archipiélago">
        {chapters.map((chapter) => {
          const unlocked = isChapterUnlocked(progress, chapter.id);
          const completed = isChapterCompleted(progress, chapter.id);
          const isSelected = activeChapter?.id === chapter.id;
          const chapterStages = getStagesForChapter(chapter.id);
          const chapterStars = chapterStages.reduce(
            (acc, st) => acc + (progress.starsByStageId[st.id] ?? 0),
            0
          );

          return (
            <button
              key={chapter.id}
              type="button"
              role="listitem"
              disabled={!unlocked}
              className={`island-card ${isSelected ? 'island-card--selected' : ''} ${
                !unlocked ? 'island-card--locked' : ''
              }`}
              style={{ '--island-accent': chapter.themeColor } as React.CSSProperties}
              onClick={() => setSelectedChapterId(chapter.id)}
            >
              <div className="island-card-top">
                <span className="island-emoji">{BIOME_BADGE[chapter.biome] ?? '🏝️'}</span>
                <span className="island-order">Isla {chapter.order}</span>
                {completed ? (
                  <span className="island-badge island-badge--done">✓ Libre</span>
                ) : !unlocked ? (
                  <span className="island-badge">🔒</span>
                ) : null}
              </div>
              <strong>{chapter.title}</strong>
              <small>{chapter.subtitle}</small>
              <div className="island-stars-row">
                ★ {chapterStars} / {chapterStages.length * 3}
              </div>
            </button>
          );
        })}
      </div>

      {activeChapter && (
        <div
          className="campaign-stages-panel"
          style={{ '--island-accent': activeChapter.themeColor } as React.CSSProperties}
        >
          <div className="campaign-panel-head">
            <div>
              <h3>
                {BIOME_BADGE[activeChapter.biome] ?? '🏝️'} {activeChapter.title}
              </h3>
              <p>{activeChapter.subtitle}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onOpenStory(activeChapter.introStoryId)}
            >
              🔊 Historia de Isla
            </button>
          </div>

          <div className="stages-row">
            {activeStages.map((stage) => {
              const unlocked = isStageUnlocked(progress, stage.id);
              const completed = progress.completedStageIds.includes(stage.id);
              const stars = progress.starsByStageId[stage.id] ?? 0;
              const isCurrent = progress.currentStageId === stage.id;

              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={!unlocked}
                  className={`stage-node ${stage.kind === 'boss' ? 'stage-node--boss' : ''} ${
                    completed ? 'stage-node--done' : ''
                  } ${isCurrent && unlocked ? 'stage-node--current' : ''}`}
                  onClick={() => onStartStage(stage)}
                >
                  <div className="stage-node-head">
                    <span className="stage-num">
                      {stage.kind === 'boss' ? '👑 Jefe' : `Etapa ${activeChapter.order}-${stage.order}`}
                    </span>
                    <span className="stage-stars" aria-label={`${stars} de 3 estrellas`}>
                      {'★'.repeat(stars)}
                      {'☆'.repeat(3 - stars)}
                    </span>
                  </div>
                  <strong>{stage.title}</strong>
                  <span className="stage-cta">
                    {!unlocked ? '🔒 Bloqueada' : completed ? '↻ Rejugar' : '▶ Jugar'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
