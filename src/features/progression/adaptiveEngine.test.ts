import { describe, expect, it } from 'vitest';
import difficultyData from '../../data/difficulty.json';
import type { DifficultyConfig } from '../../types/game';
import { AdaptiveEngine } from './adaptiveEngine';

const CONFIG = difficultyData as DifficultyConfig;

describe('AdaptiveEngine', () => {
  it('sube de nivel tras 3 aciertos seguidos y no supera el nivel máximo', () => {
    const engine = new AdaptiveEngine(CONFIG, 1);
    expect(engine.getCurrentConfig().level).toBe(1);

    engine.recordHit(true);
    engine.recordHit(true);
    const up = engine.recordHit(true);
    expect(up.levelChanged).toBe('up');
    expect(up.snapshot.level).toBe(2);

    const maxEngine = new AdaptiveEngine(CONFIG, 5);
    maxEngine.recordHit(true);
    maxEngine.recordHit(true);
    const stay = maxEngine.recordHit(true);
    expect(stay.levelChanged).toBe('none');
    expect(stay.snapshot.level).toBe(5);
  });

  it('baja de nivel tras 3 errores seguidos y no baja del nivel 1', () => {
    const engine = new AdaptiveEngine(CONFIG, 3);
    engine.recordHit(false);
    engine.recordHit(false);
    const down = engine.recordHit(false);
    expect(down.levelChanged).toBe('down');
    expect(down.snapshot.level).toBe(2);

    const minEngine = new AdaptiveEngine(CONFIG, 1);
    minEngine.recordHit(false);
    minEngine.recordHit(false);
    const stay = minEngine.recordHit(false);
    expect(stay.levelChanged).toBe('none');
    expect(stay.snapshot.level).toBe(1);
  });

  it('selecciona señuelos sin incluir tokens de la palabra objetivo', () => {
    const engine = new AdaptiveEngine(CONFIG, 2);
    const decoys = engine.selectDecoys(['LU', 'NA', 'SO'], () => 0.1);
    expect(decoys.length).toBe(CONFIG.levels[1]?.decoyCount);
    expect(decoys).not.toContain('LU');
    expect(decoys).not.toContain('NA');
    expect(decoys).not.toContain('SO');
  });

  it('sugiere pausa una sola vez al alcanzar los 15 minutos', () => {
    const engine = new AdaptiveEngine(CONFIG, 1);
    expect(engine.shouldSuggestPause(14 * 60_000, false)).toBe(false);
    expect(engine.shouldSuggestPause(15 * 60_000, false)).toBe(true);
    expect(engine.shouldSuggestPause(16 * 60_000, true)).toBe(false);
  });

  it('restaura estado acotado y permite reiniciar a nivel 1', () => {
    const engine = new AdaptiveEngine(CONFIG, 1);
    const restored = engine.restoreState({ level: 4, correctStreak: 2, wrongStreak: 9 });
    expect(restored.level).toBe(4);
    expect(restored.correctStreak).toBe(2);
    expect(restored.wrongStreak).toBe(0);

    const clamped = engine.restoreState({ level: 99, correctStreak: -3, wrongStreak: 10 });
    expect(clamped.level).toBe(5);
    expect(clamped.correctStreak).toBe(0);
    expect(clamped.wrongStreak).toBe(CONFIG.streakToLevelDown);

    const reset = engine.reset();
    expect(reset.level).toBe(1);
    expect(reset.correctStreak).toBe(0);
    expect(reset.wrongStreak).toBe(0);
  });
});
