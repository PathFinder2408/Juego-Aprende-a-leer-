import chaptersData from '../../data/chapters.json';
import stagesData from '../../data/stages.json';
import type {
  CampaignProgressState,
  ChapterConfig,
  StageConfig,
} from '../../types/campaign';

const chapters = [...(chaptersData as ChapterConfig[])].sort((a, b) => a.order - b.order);
const stages = [...(stagesData as StageConfig[])];

export interface StageCompletionResult {
  progress: CampaignProgressState;
  starsEarned: number;
  bestStars: number;
  unlockedChapterId: string | null;
  nextStageId: string | null;
  storyToTriggerId: string | null;
  isCampaignComplete: boolean;
}

export interface CampaignSummary {
  totalChapters: number;
  unlockedChapters: number;
  completedChapters: number;
  totalStages: number;
  completedStages: number;
  earnedStars: number;
  maxStars: number;
}

export function getAllChapters(): ChapterConfig[] {
  return chapters;
}

export function getAllStages(): StageConfig[] {
  return stages;
}

export function getChapterById(chapterId: string): ChapterConfig | undefined {
  return chapters.find((ch) => ch.id === chapterId);
}

export function getStageById(stageId: string): StageConfig | undefined {
  return stages.find((st) => st.id === stageId);
}

export function getStagesForChapter(chapterId: string): StageConfig[] {
  return stages
    .filter((st) => st.chapterId === chapterId)
    .sort((a, b) => a.order - b.order);
}

export function calculateStageStars(stage: StageConfig, score: number): number {
  if (score >= stage.starThresholds.threeStarsScore) return 3;
  if (score >= stage.starThresholds.twoStarsScore) return 2;
  return 1;
}

export function isChapterUnlocked(progress: CampaignProgressState, chapterId: string): boolean {
  if (chapterId === chapters[0]?.id) return true;
  return progress.unlockedChapterIds.includes(chapterId);
}

export function isStageUnlocked(progress: CampaignProgressState, stageId: string): boolean {
  const stage = getStageById(stageId);
  if (!stage) return false;
  if (!isChapterUnlocked(progress, stage.chapterId)) return false;

  if (progress.completedStageIds.includes(stageId)) {
    return true;
  }

  if (stage.order <= 1) {
    return true;
  }

  const chapterStages = getStagesForChapter(stage.chapterId);
  const previousStage = chapterStages.find((s) => s.order === stage.order - 1);
  if (!previousStage) return true;
  return progress.completedStageIds.includes(previousStage.id);
}

export function isChapterCompleted(progress: CampaignProgressState, chapterId: string): boolean {
  const chapterStages = getStagesForChapter(chapterId);
  if (chapterStages.length === 0) return false;
  return chapterStages.every((st) => progress.completedStageIds.includes(st.id));
}

/**
 * Determina qué diálogo inicial (prólogo o intro de capítulo) debe mostrarse antes de jugar una etapa.
 */
export function getPendingIntroStoryId(
  progress: CampaignProgressState,
  chapterId: string
): string | null {
  if (!progress.seenStoryIds.includes('story-prologue')) {
    return 'story-prologue';
  }
  const chapter = getChapterById(chapterId);
  if (chapter && !progress.seenStoryIds.includes(chapter.introStoryId)) {
    return chapter.introStoryId;
  }
  return null;
}

/**
 * Registra la finalización de una etapa, calcula estrellas, desbloquea la siguiente etapa/isla
 * y conserva la mejor puntuación en modo rejugar.
 */
export function recordStageCompletion(
  progress: CampaignProgressState,
  stageId: string,
  score: number
): StageCompletionResult {
  const stage = getStageById(stageId);
  if (!stage) {
    return {
      progress,
      starsEarned: 0,
      bestStars: 0,
      unlockedChapterId: null,
      nextStageId: null,
      storyToTriggerId: null,
      isCampaignComplete: false,
    };
  }

  const starsEarned = calculateStageStars(stage, score);
  const prevStars = progress.starsByStageId[stageId] ?? 0;
  const bestStars = Math.max(prevStars, starsEarned);

  const completedStageIds = progress.completedStageIds.includes(stageId)
    ? [...progress.completedStageIds]
    : [...progress.completedStageIds, stageId];

  const unlockedChapterIds = [...progress.unlockedChapterIds];
  const chapter = getChapterById(stage.chapterId);
  const chapterStages = getStagesForChapter(stage.chapterId);
  const nextInChapter = chapterStages.find((s) => s.order === stage.order + 1);

  let unlockedChapterId: string | null = null;
  let nextStageId: string | null = nextInChapter?.id ?? null;
  let nextChapterId = stage.chapterId;
  let storyToTriggerId: string | null = null;
  let isCampaignComplete = false;

  if (stage.kind === 'boss' && chapter) {
    if (!progress.seenStoryIds.includes(chapter.outroStoryId)) {
      storyToTriggerId = chapter.outroStoryId;
    }

    const nextChapter = chapters.find((ch) => ch.order === chapter.order + 1);
    if (nextChapter) {
      if (!unlockedChapterIds.includes(nextChapter.id)) {
        unlockedChapterIds.push(nextChapter.id);
        unlockedChapterId = nextChapter.id;
      }
      nextChapterId = nextChapter.id;
      nextStageId = getStagesForChapter(nextChapter.id)[0]?.id ?? nextStageId;
    } else {
      isCampaignComplete = true;
      if (!storyToTriggerId && !progress.seenStoryIds.includes('story-epilogue')) {
        storyToTriggerId = 'story-epilogue';
      }
    }
  }

  const nextProgress: CampaignProgressState = {
    ...progress,
    unlockedChapterIds,
    completedStageIds,
    starsByStageId: {
      ...progress.starsByStageId,
      [stageId]: bestStars,
    },
    currentChapterId: nextChapterId,
    currentStageId: nextStageId ?? stageId,
  };

  return {
    progress: nextProgress,
    starsEarned,
    bestStars,
    unlockedChapterId,
    nextStageId,
    storyToTriggerId,
    isCampaignComplete,
  };
}

export function getCampaignSummary(progress: CampaignProgressState): CampaignSummary {
  const earnedStars = stages.reduce(
    (sum, st) => sum + (progress.starsByStageId[st.id] ?? 0),
    0
  );
  const completedStages = stages.filter((st) =>
    progress.completedStageIds.includes(st.id)
  ).length;
  const completedChapters = chapters.filter((ch) =>
    isChapterCompleted(progress, ch.id)
  ).length;

  return {
    totalChapters: chapters.length,
    unlockedChapters: chapters.filter((ch) => isChapterUnlocked(progress, ch.id)).length,
    completedChapters,
    totalStages: stages.length,
    completedStages,
    earnedStars,
    maxStars: stages.length * 3,
  };
}
