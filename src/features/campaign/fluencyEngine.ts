import type { DomeChallengeMode, FluencyMetrics } from '../../types/game';

export type FluencyTier = 'emergent' | 'developing' | 'fluent';

export interface ChallengeCompletionSample {
  mode: DomeChallengeMode;
  accuracyPercent: number;
  durationMs: number;
  tokenCount: number;
}

export interface FluencyEvaluation {
  metrics: FluencyMetrics;
  estimatedWpm: number;
  tier: FluencyTier;
}

export interface ModeAdaptiveTuning {
  speedMultiplier: number;
  maxDecoys: number;
  gentleSupportActive: boolean;
}

const MODE_SPEED_FACTOR: Record<DomeChallengeMode, number> = {
  word: 1.0,
  sentence: 0.9,
  comprehension: 0.84,
};

export function createInitialFluencyMetrics(): FluencyMetrics {
  return {
    wordsCompleted: 0,
    sentencesCompleted: 0,
    comprehensionCompleted: 0,
    bestAccuracyPercent: 0,
  };
}

export function resolveFluencyTier(metrics: FluencyMetrics): FluencyTier {
  const total =
    metrics.wordsCompleted + metrics.sentencesCompleted + metrics.comprehensionCompleted;
  if (
    metrics.comprehensionCompleted >= 3 ||
    metrics.sentencesCompleted >= 6 ||
    total >= 15
  ) {
    return 'fluent';
  }
  if (total >= 5 || metrics.sentencesCompleted >= 2) {
    return 'developing';
  }
  return 'emergent';
}

export function estimateReadingWpm(tokenCount: number, durationMs: number): number {
  const safeTokens = Math.max(1, tokenCount);
  const safeMinutes = Math.max(2000, durationMs) / 60_000;
  return Math.max(8, Math.min(120, Math.round(safeTokens / safeMinutes)));
}

/**
 * Actualiza métricas de fluidez tras completar un reto en la Cúpula sin castigos.
 */
export function recordChallengeCompletion(
  metrics: FluencyMetrics,
  sample: ChallengeCompletionSample
): FluencyEvaluation {
  const safeAcc = Math.max(0, Math.min(100, Math.round(sample.accuracyPercent)));
  const next: FluencyMetrics = {
    wordsCompleted:
      sample.mode === 'word' ? metrics.wordsCompleted + 1 : metrics.wordsCompleted,
    sentencesCompleted:
      sample.mode === 'sentence'
        ? metrics.sentencesCompleted + 1
        : metrics.sentencesCompleted,
    comprehensionCompleted:
      sample.mode === 'comprehension'
        ? metrics.comprehensionCompleted + 1
        : metrics.comprehensionCompleted,
    bestAccuracyPercent: Math.max(metrics.bestAccuracyPercent, safeAcc),
  };

  return {
    metrics: next,
    estimatedWpm: estimateReadingWpm(sample.tokenCount, sample.durationMs),
    tier: resolveFluencyTier(next),
  };
}

/**
 * Ajusta velocidad y cantidad de señuelos según el modo de lectura y precisión reciente.
 */
export function computeModeAdaptiveTuning(
  mode: DomeChallengeMode,
  baseSpeedMultiplier: number,
  baseDecoyCount: number,
  recentAccuracyPercent = 100
): ModeAdaptiveTuning {
  const gentleSupportActive = recentAccuracyPercent < 65;
  const modeFactor = MODE_SPEED_FACTOR[mode];
  const supportFactor = gentleSupportActive ? 0.85 : 1;

  const speedMultiplier = Number(
    Math.max(0.55, baseSpeedMultiplier * modeFactor * supportFactor).toFixed(2)
  );

  const rawMaxDecoys =
    mode === 'word'
      ? baseDecoyCount
      : mode === 'sentence'
        ? Math.min(3, Math.max(1, baseDecoyCount))
        : Math.min(3, Math.max(2, baseDecoyCount));

  const maxDecoys = gentleSupportActive ? Math.max(1, rawMaxDecoys - 1) : rawMaxDecoys;

  return {
    speedMultiplier,
    maxDecoys,
    gentleSupportActive,
  };
}
