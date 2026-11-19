import type { PowerUpKind } from '../../types/campaign';

export const DEFAULT_MAX_HEARTS = 3;
export const INVULNERABILITY_AFTER_HIT_MS = 1800;
export const GOLDEN_ORB_DURATION_MS = 6000;

export const POWERUP_METADATA: Record<
  PowerUpKind,
  { label: string; speechText: string; badge: string }
> = {
  extra_bubble: {
    label: '+Burbuja',
    speechText: '¡Burbuja extra!',
    badge: '+B',
  },
  long_wave: {
    label: 'Onda +1',
    speechText: '¡Onda más larga!',
    badge: '+O',
  },
  turbo_boots: {
    label: 'Botas Turbo',
    speechText: '¡Botas turbo!',
    badge: '⚡',
  },
  solar_shield: {
    label: 'Escudo Solar',
    speechText: '¡Escudo solar!',
    badge: '🛡',
  },
  golden_orb: {
    label: 'Orbe Dorado',
    speechText: '¡Orbe dorado!',
    badge: '★',
  },
};

export interface MazeSurvivalState {
  hearts: number;
  maxHearts: number;
  hasSolarShield: boolean;
  invulnerableRemainingMs: number;
  frightenedRemainingMs: number;
  checkpointRespawns: number;
}

export interface PlayerHitResolution {
  state: MazeSurvivalState;
  absorbedByShield: boolean;
  ignoredByInvulnerability: boolean;
  checkpointTriggered: boolean;
}

export function createSurvivalState(maxHearts = DEFAULT_MAX_HEARTS): MazeSurvivalState {
  const safeMax = Math.max(1, Math.floor(maxHearts));
  return {
    hearts: safeMax,
    maxHearts: safeMax,
    hasSolarShield: false,
    invulnerableRemainingMs: 0,
    frightenedRemainingMs: 0,
    checkpointRespawns: 0,
  };
}

/**
 * Aplica el efecto de supervivencia/estado de un power-up y devuelve el texto es-CL a pronunciar.
 */
export function applySurvivalPowerUp(
  state: MazeSurvivalState,
  kind: PowerUpKind
): { state: MazeSurvivalState; speechText: string } {
  const speechText = POWERUP_METADATA[kind].speechText;

  if (kind === 'solar_shield') {
    return {
      state: {
        ...state,
        hasSolarShield: true,
      },
      speechText,
    };
  }

  if (kind === 'golden_orb') {
    return {
      state: {
        ...state,
        frightenedRemainingMs: GOLDEN_ORB_DURATION_MS,
      },
      speechText,
    };
  }

  return { state: { ...state }, speechText };
}

export function stepSurvivalTimers(
  state: MazeSurvivalState,
  dtMs: number
): MazeSurvivalState {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return state;
  return {
    ...state,
    invulnerableRemainingMs: Math.max(0, state.invulnerableRemainingMs - dtMs),
    frightenedRemainingMs: Math.max(0, state.frightenedRemainingMs - dtMs),
  };
}

/**
 * Resuelve el impacto de un enemigo respetando invulnerabilidad breve, escudo solar y checkpoint.
 */
export function applyPlayerEnemyHit(state: MazeSurvivalState): PlayerHitResolution {
  if (state.invulnerableRemainingMs > 0) {
    return {
      state,
      absorbedByShield: false,
      ignoredByInvulnerability: true,
      checkpointTriggered: false,
    };
  }

  if (state.hasSolarShield) {
    return {
      state: {
        ...state,
        hasSolarShield: false,
        invulnerableRemainingMs: INVULNERABILITY_AFTER_HIT_MS,
      },
      absorbedByShield: true,
      ignoredByInvulnerability: false,
      checkpointTriggered: false,
    };
  }

  const nextHearts = Math.max(0, state.hearts - 1);
  if (nextHearts === 0) {
    return {
      state: {
        ...state,
        hearts: state.maxHearts,
        invulnerableRemainingMs: INVULNERABILITY_AFTER_HIT_MS,
        checkpointRespawns: state.checkpointRespawns + 1,
      },
      absorbedByShield: false,
      ignoredByInvulnerability: false,
      checkpointTriggered: true,
    };
  }

  return {
    state: {
      ...state,
      hearts: nextHearts,
      invulnerableRemainingMs: INVULNERABILITY_AFTER_HIT_MS,
    },
    absorbedByShield: false,
    ignoredByInvulnerability: false,
    checkpointTriggered: false,
  };
}
