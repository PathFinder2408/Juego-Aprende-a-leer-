import { describe, expect, it } from 'vitest';
import type { CampaignProgressState } from '../../types/campaign';
import {
  getAllChapters,
  getAllStages,
  getCampaignSummary,
  getPendingIntroStoryId,
  isChapterUnlocked,
  isStageUnlocked,
  recordStageCompletion,
} from './campaignLogic';

function makeInitialProgress(): CampaignProgressState {
  return {
    unlockedChapterIds: ['ch1'],
    completedStageIds: [],
    starsByStageId: {},
    seenStoryIds: [],
    equippedCardId: null,
    currentChapterId: 'ch1',
    currentStageId: 'ch1-1',
  };
}

describe('campaignLogic', () => {
  it('define 6 capítulos y 30 etapas coherentes entre sí', () => {
    const chapters = getAllChapters();
    const stages = getAllStages();

    expect(chapters).toHaveLength(6);
    expect(stages).toHaveLength(30);

    for (const ch of chapters) {
      const chStages = stages.filter((s) => s.chapterId === ch.id);
      expect(chStages).toHaveLength(5);
      expect(chStages.some((s) => s.kind === 'boss')).toBe(true);
    }
  });

  it('desbloquea etapas secuencialmente, abre el capítulo siguiente al derrotar al jefe y conserva estrellas al rejugar', () => {
    let progress = makeInitialProgress();

    expect(isChapterUnlocked(progress, 'ch1')).toBe(true);
    expect(isChapterUnlocked(progress, 'ch2')).toBe(false);
    expect(isStageUnlocked(progress, 'ch1-1')).toBe(true);
    expect(isStageUnlocked(progress, 'ch1-2')).toBe(false);

    // Completar ch1-1 con puntuación máxima (3 estrellas)
    const r1 = recordStageCompletion(progress, 'ch1-1', 350);
    progress = r1.progress;
    expect(r1.starsEarned).toBe(3);
    expect(r1.nextStageId).toBe('ch1-2');
    expect(isStageUnlocked(progress, 'ch1-2')).toBe(true);

    // Rejugar ch1-1 con puntuación baja nunca reduce las 3 estrellas guardadas
    const replay = recordStageCompletion(progress, 'ch1-1', 50);
    progress = replay.progress;
    expect(replay.starsEarned).toBe(1);
    expect(replay.bestStars).toBe(3);
    expect(progress.starsByStageId['ch1-1']).toBe(3);

    // Completar jefe ch1-boss desbloquea Capítulo 2 y dispara outro del capítulo 1
    const bossRes = recordStageCompletion(progress, 'ch1-boss', 300);
    progress = bossRes.progress;
    expect(bossRes.unlockedChapterId).toBe('ch2');
    expect(bossRes.storyToTriggerId).toBe('story-ch1-outro');
    expect(isChapterUnlocked(progress, 'ch2')).toBe(true);
    expect(isStageUnlocked(progress, 'ch2-1')).toBe(true);

    const summary = getCampaignSummary(progress);
    expect(summary.unlockedChapters).toBe(2);
    expect(summary.completedStages).toBe(2);
    expect(summary.earnedStars).toBe(5);
    expect(summary.maxStars).toBe(90);
  });

  it('secuencia prólogo, intro de capítulo y epílogo final tras ch6-boss', () => {
    let progress = makeInitialProgress();
    expect(getPendingIntroStoryId(progress, 'ch1')).toBe('story-prologue');

    progress = { ...progress, seenStoryIds: ['story-prologue'] };
    expect(getPendingIntroStoryId(progress, 'ch1')).toBe('story-ch1-intro');

    progress = {
      ...progress,
      unlockedChapterIds: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'],
      seenStoryIds: ['story-prologue', 'story-ch6-outro'],
    };

    const finalRes = recordStageCompletion(progress, 'ch6-boss', 700);
    expect(finalRes.isCampaignComplete).toBe(true);
    expect(finalRes.storyToTriggerId).toBe('story-epilogue');
    expect(finalRes.starsEarned).toBe(3);
  });
});
