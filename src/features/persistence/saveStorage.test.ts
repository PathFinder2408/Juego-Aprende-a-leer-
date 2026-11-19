import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '../../config/accessibility';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  createDefaultSaveState,
  loadSaveState,
  migrateSave,
  resetProgressState,
  runMigrations,
  saveGameState,
  type SaveMigration,
  type StorageLike,
} from './saveStorage';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('saveStorage', () => {
  it('devuelve estado por defecto si el storage está vacío o no existe', () => {
    const empty = loadSaveState(createMemoryStorage());
    expect(empty.version).toBe(CURRENT_SAVE_VERSION);
    expect(empty.capturedWordIds).toEqual([]);
    expect(empty.completedCardIds).toEqual([]);
    expect(empty.progression).toEqual({ level: 1, correctStreak: 0, wrongStreak: 0 });
    expect(empty.accessibility).toEqual(DEFAULT_ACCESSIBILITY_SETTINGS);

    const noStorage = loadSaveState(null);
    expect(noStorage.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('guarda y carga progreso y accesibilidad correctamente', () => {
    const storage = createMemoryStorage();
    const state = {
      ...createDefaultSaveState('2026-11-18T14:00:00.000Z'),
      capturedWordIds: ['sol', 'luna'],
      completedCardIds: ['card-solin'],
      progression: { level: 3, correctStreak: 2, wrongStreak: 0 },
      accessibility: {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        slowFloating: true,
        highContrast: true,
      },
    };

    expect(saveGameState(state, storage)).toBe(true);
    const loaded = loadSaveState(storage);

    expect(loaded.capturedWordIds).toEqual(['sol', 'luna']);
    expect(loaded.completedCardIds).toEqual(['card-solin']);
    expect(loaded.progression).toEqual({ level: 3, correctStreak: 2, wrongStreak: 0 });
    expect(loaded.accessibility.slowFloating).toBe(true);
    expect(loaded.accessibility.highContrast).toBe(true);
    expect(loaded.accessibility.voiceEnabled).toBe(true);
  });

  it('migra datos heredados v0 sin version y soporta cadena multi-versión', () => {
    const legacy = {
      capturedWords: ['sol', 'invalida', 'sol'],
      completedCardIds: ['card-solin', 'card-falsa'],
      level: 4,
      correctStreak: 2,
      settings: {
        voiceEnabled: false,
        reducedMotion: true,
      },
    };

    const migrated = migrateSave(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.capturedWordIds).toEqual(['sol']);
    expect(migrated.completedCardIds).toEqual(['card-solin']);
    expect(migrated.progression).toEqual({ level: 4, correctStreak: 2, wrongStreak: 0 });
    expect(migrated.accessibility.voiceEnabled).toBe(false);
    expect(migrated.accessibility.reducedMotion).toBe(true);
    expect(migrated.accessibility.sfxEnabled).toBe(true);
    expect(migrated.campaign.unlockedChapterIds).toEqual(['ch1']);
    expect(migrated.fluency.wordsCompleted).toBe(1);

    const v1Save = {
      version: 1,
      capturedWordIds: ['sol', 'luna'],
      completedCardIds: ['card-solin'],
      progression: { level: 3, correctStreak: 1, wrongStreak: 0 },
      accessibility: {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        highContrast: true,
      },
      updatedAt: '2026-11-18T14:00:00.000Z',
    };
    const migratedFromV1 = migrateSave(v1Save);
    expect(migratedFromV1.version).toBe(2);
    expect(migratedFromV1.capturedWordIds).toEqual(['sol', 'luna']);
    expect(migratedFromV1.accessibility.highContrast).toBe(true);
    expect(migratedFromV1.campaign.currentStageId).toBe('ch1-1');
    expect(migratedFromV1.fluency.wordsCompleted).toBe(2);

    const customMigrations: Record<number, SaveMigration> = {
      0: (data) => ({ ...data, version: 1, step1: true }),
      1: (data) => ({ ...data, version: 2, step2: true }),
    };
    const chained = runMigrations({ legacy: true }, 2, customMigrations);
    expect(chained).toEqual({ legacy: true, version: 2, step1: true, step2: true });
  });

  it('sanea campaña, estrellas y métricas de fluidez fuera de rango', () => {
    const storage = createMemoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({
        version: 2,
        capturedWordIds: ['sol'],
        completedCardIds: [],
        progression: { level: 2, correctStreak: 0, wrongStreak: 0 },
        accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
        campaign: {
          unlockedChapterIds: ['ch2', 'ch99'],
          completedStageIds: ['ch1-1', 'etapa-falsa'],
          starsByStageId: { 'ch1-1': 9, 'etapa-falsa': 3 },
          seenStoryIds: ['story-prologue', ''],
          equippedCardId: 'card-inexistente',
          currentChapterId: 'ch99',
          currentStageId: 'ch1-2',
        },
        fluency: {
          wordsCompleted: -5,
          sentencesCompleted: 4,
          comprehensionCompleted: 2,
          bestAccuracyPercent: 140,
        },
      }),
    });

    const loaded = loadSaveState(storage);
    expect(loaded.campaign.unlockedChapterIds).toEqual(['ch1', 'ch2']);
    expect(loaded.campaign.completedStageIds).toEqual(['ch1-1']);
    expect(loaded.campaign.starsByStageId).toEqual({ 'ch1-1': 3 });
    expect(loaded.campaign.seenStoryIds).toEqual(['story-prologue']);
    expect(loaded.campaign.equippedCardId).toBeNull();
    expect(loaded.campaign.currentChapterId).toBe('ch1');
    expect(loaded.campaign.currentStageId).toBe('ch1-2');
    expect(loaded.fluency).toEqual({
      wordsCompleted: 0,
      sentencesCompleted: 4,
      comprehensionCompleted: 2,
      bestAccuracyPercent: 100,
    });
  });

  it('maneja JSON corrupto, versión futura y fallos de storage sin lanzar errores', () => {
    const corruptStorage = createMemoryStorage({ [SAVE_STORAGE_KEY]: '{json-roto' });
    expect(loadSaveState(corruptStorage).capturedWordIds).toEqual([]);

    const futureStorage = createMemoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ version: 99, capturedWordIds: ['sol'] }),
    });
    expect(loadSaveState(futureStorage).capturedWordIds).toEqual([]);

    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(loadSaveState(throwingStorage).version).toBe(CURRENT_SAVE_VERSION);
    expect(saveGameState(createDefaultSaveState(), throwingStorage)).toBe(false);
  });

  it('reinicia progreso conservando los ajustes de accesibilidad', () => {
    const storage = createMemoryStorage();
    const customAccessibility = {
      ...DEFAULT_ACCESSIBILITY_SETTINGS,
      sfxEnabled: false,
      highContrast: true,
    };

    saveGameState(
      {
        ...createDefaultSaveState(),
        capturedWordIds: ['sol', 'sapo'],
        completedCardIds: ['card-solin'],
        progression: { level: 4, correctStreak: 1, wrongStreak: 0 },
        accessibility: customAccessibility,
      },
      storage
    );

    const reset = resetProgressState(customAccessibility, storage);
    expect(reset.capturedWordIds).toEqual([]);
    expect(reset.completedCardIds).toEqual([]);
    expect(reset.progression).toEqual({ level: 1, correctStreak: 0, wrongStreak: 0 });
    expect(reset.accessibility).toEqual(customAccessibility);

    const reloaded = loadSaveState(storage);
    expect(reloaded.capturedWordIds).toEqual([]);
    expect(reloaded.accessibility).toEqual(customAccessibility);
  });

  it('persiste y sanea estilos deportivos del personaje (futbol7 y kayros24)', () => {
    const storage = createMemoryStorage();
    expect(loadSaveState(storage).playerSkin).toBe('explorer');

    saveGameState({ ...createDefaultSaveState(), playerSkin: 'futbol7' }, storage);
    expect(loadSaveState(storage).playerSkin).toBe('futbol7');

    saveGameState({ ...createDefaultSaveState(), playerSkin: 'kayros24' }, storage);
    expect(loadSaveState(storage).playerSkin).toBe('kayros24');

    const invalidSkinStorage = createMemoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({
        ...createDefaultSaveState(),
        playerSkin: 'skin-inventado',
      }),
    });
    expect(loadSaveState(invalidSkinStorage).playerSkin).toBe('explorer');
  });
});
