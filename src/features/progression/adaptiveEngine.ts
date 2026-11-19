import difficultyData from '../../data/difficulty.json';
import type {
  DifficultyConfig,
  DifficultyLevelConfig,
  DomeChallengeMode,
  PersistedProgressionState,
  ProgressionSnapshot,
} from '../../types/game';
import {
  computeModeAdaptiveTuning,
  type ModeAdaptiveTuning,
} from '../campaign/fluencyEngine';

export type LevelDirection = 'up' | 'down' | 'none';

export interface AdaptationResult {
  levelChanged: LevelDirection;
  snapshot: ProgressionSnapshot;
}

export class AdaptiveEngine {
  private readonly config: DifficultyConfig;
  private readonly levels: DifficultyLevelConfig[];
  private levelIndex: number;
  private correctStreak = 0;
  private wrongStreak = 0;

  constructor(config: DifficultyConfig = difficultyData as DifficultyConfig, initialLevel = 1) {
    if (config.levels.length === 0) {
      throw new Error('DifficultyConfig debe incluir al menos un nivel');
    }
    this.config = config;
    this.levels = [...config.levels].sort((a, b) => a.level - b.level);
    this.levelIndex = this.resolveLevelIndex(initialLevel);
  }

  private resolveLevelIndex(level: number): number {
    if (!Number.isFinite(level)) return 0;
    const foundIdx = this.levels.findIndex((item) => item.level >= level);
    return foundIdx === -1 ? this.levels.length - 1 : foundIdx;
  }

  restoreState(state: Partial<PersistedProgressionState>): ProgressionSnapshot {
    this.levelIndex =
      typeof state.level === 'number' ? this.resolveLevelIndex(state.level) : 0;

    const rawCorrect =
      typeof state.correctStreak === 'number' && Number.isFinite(state.correctStreak)
        ? Math.floor(state.correctStreak)
        : 0;
    const rawWrong =
      typeof state.wrongStreak === 'number' && Number.isFinite(state.wrongStreak)
        ? Math.floor(state.wrongStreak)
        : 0;

    const clampedCorrect = Math.max(0, Math.min(rawCorrect, this.config.streakToLevelUp));
    const clampedWrong = Math.max(0, Math.min(rawWrong, this.config.streakToLevelDown));

    this.correctStreak = clampedCorrect;
    this.wrongStreak = clampedCorrect > 0 ? 0 : clampedWrong;

    return this.getSnapshot();
  }

  reset(): ProgressionSnapshot {
    this.levelIndex = 0;
    this.correctStreak = 0;
    this.wrongStreak = 0;
    return this.getSnapshot();
  }

  getCurrentConfig(): DifficultyLevelConfig {
    const current = this.levels[this.levelIndex];
    if (!current) {
      throw new Error('Índice de nivel fuera de rango');
    }
    return current;
  }

  getSnapshot(): ProgressionSnapshot {
    const cfg = this.getCurrentConfig();
    return {
      level: cfg.level,
      label: cfg.label,
      decoyCount: cfg.decoyCount,
      speedMultiplier: cfg.speedMultiplier,
      correctStreak: this.correctStreak,
      wrongStreak: this.wrongStreak,
    };
  }

  recordHit(correct: boolean): AdaptationResult {
    if (correct) {
      this.correctStreak += 1;
      this.wrongStreak = 0;

      if (this.correctStreak >= this.config.streakToLevelUp) {
        if (this.levelIndex < this.levels.length - 1) {
          this.levelIndex += 1;
          this.correctStreak = 0;
          return { levelChanged: 'up', snapshot: this.getSnapshot() };
        }
        // Ya está en el nivel máximo: mantiene racha acotada sin desbordar
        this.correctStreak = this.config.streakToLevelUp;
      }

      return { levelChanged: 'none', snapshot: this.getSnapshot() };
    }

    this.wrongStreak += 1;
    this.correctStreak = 0;

    if (this.wrongStreak >= this.config.streakToLevelDown) {
      if (this.levelIndex > 0) {
        this.levelIndex -= 1;
        this.wrongStreak = 0;
        return { levelChanged: 'down', snapshot: this.getSnapshot() };
      }
      this.wrongStreak = this.config.streakToLevelDown;
    }

    return { levelChanged: 'none', snapshot: this.getSnapshot() };
  }

  /**
   * Elige señuelos desde el JSON del nivel actual excluyendo cualquier token
   * que pertenezca a la palabra objetivo.
   */
  selectDecoys(targetTokens: string[], rng: () => number = Math.random): string[] {
    const cfg = this.getCurrentConfig();
    if (cfg.decoyCount <= 0) return [];

    const forbidden = new Set(targetTokens.map((t) => t.trim().toUpperCase()));
    const candidates = cfg.decoyPool.filter((token) => !forbidden.has(token.trim().toUpperCase()));

    // Mezcla Fisher-Yates para variar señuelos entre rondas
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      const swap = pool[j];
      if (tmp !== undefined && swap !== undefined) {
        pool[i] = swap;
        pool[j] = tmp;
      }
    }

    return pool.slice(0, cfg.decoyCount);
  }

  /**
   * Ajusta velocidad y tope de señuelos según el modo de reto (sílabas, frases o comprensión).
   */
  getModeTuning(mode: DomeChallengeMode, recentAccuracyPercent = 100): ModeAdaptiveTuning {
    const cfg = this.getCurrentConfig();
    return computeModeAdaptiveTuning(
      mode,
      cfg.speedMultiplier,
      cfg.decoyCount,
      recentAccuracyPercent
    );
  }

  /**
   * Selecciona señuelos para un reto combinando pool explícito (oraciones/comprensión) o niveles base.
   */
  selectChallengeDecoys(
    mode: DomeChallengeMode,
    targetTokens: string[],
    explicitDecoys: string[] = [],
    rng: () => number = Math.random
  ): string[] {
    const tuning = this.getModeTuning(mode);
    if (explicitDecoys.length > 0) {
      const forbidden = new Set(targetTokens.map((t) => t.trim().toUpperCase()));
      return explicitDecoys
        .filter((token) => !forbidden.has(token.trim().toUpperCase()))
        .slice(0, tuning.maxDecoys);
    }
    return this.selectDecoys(targetTokens, rng);
  }

  shouldSuggestPause(elapsedMs: number, alreadyReminded = false): boolean {
    if (alreadyReminded) return false;
    return elapsedMs >= this.config.pauseReminderMinutes * 60_000;
  }

  getPauseReminderMinutes(): number {
    return this.config.pauseReminderMinutes;
  }
}

export const adaptiveEngine = new AdaptiveEngine();
