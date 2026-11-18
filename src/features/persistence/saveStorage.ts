import { DEFAULT_ACCESSIBILITY_SETTINGS } from '../../config/accessibility';
import cardsData from '../../data/cards.json';
import difficultyData from '../../data/difficulty.json';
import wordsData from '../../data/words.json';
import type {
  AccessibilitySettings,
  CardEntry,
  DifficultyConfig,
  PersistedProgressionState,
  SaveState,
  WordEntry,
} from '../../types/game';

export const SAVE_STORAGE_KEY = 'cupula_letras_save';
export const CURRENT_SAVE_VERSION = 1;

export type SaveRecord = Record<string, unknown>;
export type SaveMigration = (data: SaveRecord) => SaveRecord;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const difficultyConfig = difficultyData as DifficultyConfig;
const sortedLevels = [...difficultyConfig.levels].sort((a, b) => a.level - b.level);
const MIN_LEVEL = sortedLevels[0]?.level ?? 1;
const MAX_LEVEL = sortedLevels[sortedLevels.length - 1]?.level ?? MIN_LEVEL;

const VALID_WORD_IDS = new Set((wordsData as WordEntry[]).map((entry) => entry.id));
const VALID_CARD_IDS = new Set((cardsData as CardEntry[]).map((entry) => entry.id));

function isRecord(value: unknown): value is SaveRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeIdList(raw: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item === 'string' && allowedIds.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function sanitizeAccessibility(raw: unknown): AccessibilitySettings {
  const source = isRecord(raw) ? raw : {};
  return {
    voiceEnabled:
      typeof source.voiceEnabled === 'boolean'
        ? source.voiceEnabled
        : DEFAULT_ACCESSIBILITY_SETTINGS.voiceEnabled,
    sfxEnabled:
      typeof source.sfxEnabled === 'boolean'
        ? source.sfxEnabled
        : DEFAULT_ACCESSIBILITY_SETTINGS.sfxEnabled,
    slowFloating:
      typeof source.slowFloating === 'boolean'
        ? source.slowFloating
        : DEFAULT_ACCESSIBILITY_SETTINGS.slowFloating,
    reducedMotion:
      typeof source.reducedMotion === 'boolean'
        ? source.reducedMotion
        : DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion,
    highContrast:
      typeof source.highContrast === 'boolean'
        ? source.highContrast
        : DEFAULT_ACCESSIBILITY_SETTINGS.highContrast,
  };
}

function sanitizeProgression(raw: unknown): PersistedProgressionState {
  const source = isRecord(raw) ? raw : {};
  const level = clampInt(source.level, MIN_LEVEL, MAX_LEVEL, MIN_LEVEL);
  const correctStreak = clampInt(source.correctStreak, 0, difficultyConfig.streakToLevelUp, 0);
  const wrongStreak =
    correctStreak > 0 ? 0 : clampInt(source.wrongStreak, 0, difficultyConfig.streakToLevelDown, 0);

  return { level, correctStreak, wrongStreak };
}

export function createDefaultSaveState(updatedAt = new Date().toISOString()): SaveState {
  return {
    version: CURRENT_SAVE_VERSION,
    capturedWordIds: [],
    completedCardIds: [],
    progression: {
      level: MIN_LEVEL,
      correctStreak: 0,
      wrongStreak: 0,
    },
    accessibility: { ...DEFAULT_ACCESSIBILITY_SETTINGS },
    updatedAt,
  };
}

export function sanitizeSaveState(raw: unknown): SaveState {
  if (!isRecord(raw)) {
    return createDefaultSaveState();
  }

  const fallbackTime = new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : fallbackTime;

  return {
    version: CURRENT_SAVE_VERSION,
    capturedWordIds: sanitizeIdList(raw.capturedWordIds, VALID_WORD_IDS),
    completedCardIds: sanitizeIdList(raw.completedCardIds, VALID_CARD_IDS),
    progression: sanitizeProgression(raw.progression),
    accessibility: sanitizeAccessibility(raw.accessibility),
    updatedAt,
  };
}

/**
 * Migraciones incrementales de esquema por número de versión.
 * v0 -> v1 normaliza guardados heredados sin campo `version` o con claves planas previas.
 */
export const SAVE_MIGRATIONS: Record<number, SaveMigration> = {
  0: (legacy) => {
    const capturedWordIds = Array.isArray(legacy.capturedWordIds)
      ? legacy.capturedWordIds
      : legacy.capturedWords;

    const progression = isRecord(legacy.progression)
      ? legacy.progression
      : {
          level: legacy.level,
          correctStreak: legacy.correctStreak,
          wrongStreak: legacy.wrongStreak,
        };

    const accessibility = isRecord(legacy.accessibility) ? legacy.accessibility : legacy.settings;

    return {
      ...legacy,
      version: 1,
      capturedWordIds,
      completedCardIds: legacy.completedCardIds,
      progression,
      accessibility,
      updatedAt: legacy.updatedAt,
    };
  },
};

export function runMigrations(
  raw: unknown,
  targetVersion = CURRENT_SAVE_VERSION,
  migrations: Record<number, SaveMigration> = SAVE_MIGRATIONS
): SaveRecord | null {
  if (!isRecord(raw)) return null;

  let version: number;
  if (raw.version === undefined || raw.version === null) {
    version = 0;
  } else if (typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version >= 0) {
    version = raw.version;
  } else {
    return null;
  }

  // Evita interpretar versiones futuras potencialmente incompatibles
  if (version > targetVersion) {
    return null;
  }

  let current: SaveRecord = { ...raw };
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) return null;

    current = migrate(current);
    const nextVersion = typeof current.version === 'number' ? current.version : version + 1;
    if (!Number.isInteger(nextVersion) || nextVersion <= version) {
      return null;
    }
    version = nextVersion;
  }

  return current;
}

export function migrateSave(raw: unknown): SaveState {
  const migrated = runMigrations(raw, CURRENT_SAVE_VERSION, SAVE_MIGRATIONS);
  if (!migrated) {
    return createDefaultSaveState();
  }
  return sanitizeSaveState(migrated);
}

export function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSaveState(storage: StorageLike | null = getDefaultStorage()): SaveState {
  if (!storage) return createDefaultSaveState();
  try {
    const rawText = storage.getItem(SAVE_STORAGE_KEY);
    if (!rawText) return createDefaultSaveState();
    const parsed: unknown = JSON.parse(rawText);
    return migrateSave(parsed);
  } catch {
    return createDefaultSaveState();
  }
}

export function saveGameState(
  state: SaveState,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    const sanitized = sanitizeSaveState(state);
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function resetProgressState(
  preservedAccessibility: AccessibilitySettings,
  storage: StorageLike | null = getDefaultStorage()
): SaveState {
  const fresh = createDefaultSaveState();
  const nextState: SaveState = {
    ...fresh,
    accessibility: sanitizeAccessibility(preservedAccessibility),
  };
  saveGameState(nextState, storage);
  return nextState;
}

export function clearSaveState(storage: StorageLike | null = getDefaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
