import { describe, expect, it } from 'vitest';
import { adaptiveEngine } from '../progression/adaptiveEngine';
import {
  computeModeAdaptiveTuning,
  createInitialFluencyMetrics,
  recordChallengeCompletion,
  resolveFluencyTier,
} from './fluencyEngine';

describe('fluencyEngine y adaptación por modo', () => {
  it('registra progreso entre palabras, oraciones y comprensión y evoluciona el nivel de fluidez', () => {
    let metrics = createInitialFluencyMetrics();
    expect(resolveFluencyTier(metrics)).toBe('emergent');

    for (let i = 0; i < 3; i += 1) {
      metrics = recordChallengeCompletion(metrics, {
        mode: 'word',
        accuracyPercent: 90,
        durationMs: 6000,
        tokenCount: 3,
      }).metrics;
    }
    const sentEval = recordChallengeCompletion(metrics, {
      mode: 'sentence',
      accuracyPercent: 100,
      durationMs: 9000,
      tokenCount: 5,
    });
    metrics = sentEval.metrics;
    expect(sentEval.estimatedWpm).toBeGreaterThanOrEqual(25);
    expect(metrics.wordsCompleted).toBe(3);
    expect(metrics.sentencesCompleted).toBe(1);

    // Al llegar a 2 oraciones pasa a 'developing' y con 3 comprensiones a 'fluent'
    metrics = recordChallengeCompletion(metrics, {
      mode: 'sentence',
      accuracyPercent: 85,
      durationMs: 8000,
      tokenCount: 5,
    }).metrics;
    expect(resolveFluencyTier(metrics)).toBe('developing');

    for (let i = 0; i < 3; i += 1) {
      metrics = recordChallengeCompletion(metrics, {
        mode: 'comprehension',
        accuracyPercent: 95,
        durationMs: 10000,
        tokenCount: 1,
      }).metrics;
    }
    expect(resolveFluencyTier(metrics)).toBe('fluent');
    expect(metrics.bestAccuracyPercent).toBe(100);
  });

  it('adapta velocidad y señuelos con apoyo suave sin castigo ante baja precisión', () => {
    const wordTuning = computeModeAdaptiveTuning('word', 1.0, 2, 95);
    const compTuning = computeModeAdaptiveTuning('comprehension', 1.0, 3, 95);
    expect(compTuning.speedMultiplier).toBeLessThan(wordTuning.speedMultiplier);

    const gentle = computeModeAdaptiveTuning('sentence', 1.0, 3, 50);
    expect(gentle.gentleSupportActive).toBe(true);
    expect(gentle.maxDecoys).toBeLessThan(3);
    expect(gentle.speedMultiplier).toBeLessThan(0.85);

    const decoys = adaptiveEngine.selectChallengeDecoys(
      'sentence',
      ['LA', 'LUNA'],
      ['PALA', 'MESA', 'NUBE', 'SOL'],
      () => 0.5
    );
    expect(decoys.length).toBeLessThanOrEqual(3);
  });
});
