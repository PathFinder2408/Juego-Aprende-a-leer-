import { describe, expect, it } from 'vitest';
import type { MazeEnemySpawn, MazeMapConfig } from '../../types/campaign';
import {
  DEFAULT_ENEMY_STUN_MS,
  SCORE_SCARE_CATCH,
  SCORE_STUN_ENEMY,
  canEnemyHarmPlayer,
  createEnemyGridContext,
  createEnemyStates,
  hasLineOfSight,
  isEnemyWalkableTile,
  resolveEnemyContacts,
  stepEnemies,
} from './enemyAI';
import { MazeEngine } from './mazeEngine';

function makeMap(layout: string[], enemies: MazeEnemySpawn[] = []): MazeMapConfig {
  return {
    id: 'ai-test',
    cols: layout[0]?.length ?? 0,
    rows: layout.length,
    biome: 'beach',
    layout,
    syllableTokens: [],
    powerUpPool: [],
    enemies,
  };
}

describe('enemyAI', () => {
  it('patrulla manteniendo rutas válidas en grilla sin atravesar muros, bloques ni burbujas', () => {
    const spawns: MazeEnemySpawn[] = [
      {
        id: 'patrol-1',
        kind: 'sleepy_shadow',
        behavior: 'patrol',
        spawn: { col: 1, row: 1 },
        speedTilesPerSec: 2.5,
      },
    ];
    const map = makeMap(
      [
        '#######',
        '#   B #',
        '# # # #',
        '#P    #',
        '#######',
      ],
      spawns
    );

    const engine = new MazeEngine(map);
    // Coloca burbuja en (1, 3) y se mueve a (2, 3) para probar obstáculo de burbuja
    engine.step(0.3, { direction: 'right', placeBubble: true });

    const enemies = createEnemyStates(spawns);
    const ctx = createEnemyGridContext(engine.getState(), false);

    // Simular 4 segundos de patrulla frame a frame verificando cada posición
    for (let i = 0; i < 240; i += 1) {
      stepEnemies(enemies, ctx, 1 / 60);
      const e = enemies[0];
      expect(e).toBeDefined();
      if (e) {
        expect(isEnemyWalkableTile(ctx, e.tile.col, e.tile.row)).toBe(true);
      }
    }
  });

  it('detecta línea de vista en chase_los y persigue esquinas mediante BFS', () => {
    const spawns: MazeEnemySpawn[] = [
      {
        id: 'crab-1',
        kind: 'mischief_crab',
        behavior: 'chase_los',
        spawn: { col: 5, row: 1 },
        speedTilesPerSec: 3,
      },
    ];
    const map = makeMap(
      [
        '#######',
        '#P    #',
        '##### #',
        '#     #',
        '#######',
      ],
      spawns
    );

    const engine = new MazeEngine(map);
    const enemies = createEnemyStates(spawns);
    const ctxOpen = createEnemyGridContext(engine.getState(), false);

    // En fila 1 hay línea de vista libre entre (5, 1) y (1, 1)
    expect(hasLineOfSight(ctxOpen, { col: 5, row: 1 }, { col: 1, row: 1 })).toBe(true);

    // Avanza hacia el jugador por la fila 1
    stepEnemies(enemies, ctxOpen, 0.8);
    const crab = enemies[0];
    expect(crab?.alertedByLos).toBe(true);
    expect(crab?.x).toBeLessThan(3.5);

    // Si hay un bloque blando en medio, bloquea la línea de vista
    const blockedMap = makeMap(
      [
        '#######',
        '#P B  #',
        '#######',
      ],
      spawns
    );
    const blockedCtx = createEnemyGridContext(new MazeEngine(blockedMap).getState(), false);
    expect(hasLineOfSight(blockedCtx, { col: 5, row: 1 }, { col: 1, row: 1 })).toBe(false);
  });

  it('transiciona normal -> stunned al tocar onda de burbuja y recupera después del tiempo', () => {
    const spawns: MazeEnemySpawn[] = [
      {
        id: 'stun-1',
        kind: 'sleepy_shadow',
        behavior: 'patrol',
        spawn: { col: 3, row: 1 },
        speedTilesPerSec: 2.5,
      },
    ];
    const map = makeMap(
      [
        '#######',
        '#P    #',
        '#######',
      ],
      spawns
    );

    const engine = new MazeEngine(map, { initialWaveRange: 2, bubbleFuseMs: 500 });
    // Colocar burbuja en (1, 1) con rango 2 -> onda alcanza (3, 1)
    engine.placeBubble();
    const boom = engine.step(0.55, {});
    expect(boom.snapshot.activeWaves).toHaveLength(1);

    const enemies = createEnemyStates(spawns);
    const ctxWave = createEnemyGridContext(boom.snapshot, false);
    const hitEvents = stepEnemies(enemies, ctxWave, 0.05);

    expect(hitEvents).toContainEqual({
      type: 'enemy_stunned',
      enemyId: 'stun-1',
      point: { col: 3, row: 1 },
      scoreGained: SCORE_STUN_ENEMY,
    });
    expect(enemies[0]?.state).toBe('stunned');
    expect(canEnemyHarmPlayer(enemies[0]!)).toBe(false);

    const stunnedPos = { x: enemies[0]!.x, y: enemies[0]!.y };
    // Avanzar mientras sigue aturdido sin ondas activas: no debe moverse ni dañar
    const clearSnap = engine.step(1.0, {}).snapshot;
    const ctxClear = createEnemyGridContext(clearSnap, false);
    stepEnemies(enemies, ctxClear, 1.5);
    expect(enemies[0]?.state).toBe('stunned');
    expect(enemies[0]?.x).toBe(stunnedPos.x);
    expect(enemies[0]?.y).toBe(stunnedPos.y);

    // Completar el resto del aturdimiento -> vuelve a normal
    const recoverEvents = stepEnemies(enemies, ctxClear, DEFAULT_ENEMY_STUN_MS / 1000);
    expect(enemies[0]?.state).toBe('normal');
    expect(canEnemyHarmPlayer(enemies[0]!)).toBe(true);
    expect(recoverEvents).toContainEqual({ type: 'enemy_recovered', enemyId: 'stun-1' });
  });

  it('huye en estado frightened (Orbe Dorado) y permite captura amigable sin castigo', () => {
    const spawns: MazeEnemySpawn[] = [
      {
        id: 'flee-1',
        kind: 'mischief_crab',
        behavior: 'chase_los',
        spawn: { col: 3, row: 1 },
        speedTilesPerSec: 2.5,
      },
    ];
    const map = makeMap(
      [
        '#########',
        '#P      #',
        '#########',
      ],
      spawns
    );

    const engine = new MazeEngine(map);
    const enemies = createEnemyStates(spawns);
    const ctxFright = createEnemyGridContext(engine.getState(), true);

    const evStart = stepEnemies(enemies, ctxFright, 0.6);
    expect(evStart).toContainEqual({ type: 'enemy_frightened_started', enemyId: 'flee-1' });
    expect(enemies[0]?.state).toBe('frightened');
    // Debe haberse alejado hacia la derecha (x > 3)
    expect(enemies[0]!.x).toBeGreaterThan(3.5);

    // Simular contacto del jugador con el enemigo asustado -> captura segura y retorno al spawn
    enemies[0]!.x = ctxFright.playerX + 0.2;
    enemies[0]!.y = ctxFright.playerY;
    enemies[0]!.tile = { ...ctxFright.playerTile };

    const contacts = resolveEnemyContacts(enemies, ctxFright);
    expect(contacts).toEqual([
      {
        type: 'enemy_caught_frightened',
        enemyId: 'flee-1',
        point: ctxFright.playerTile,
        scoreGained: SCORE_SCARE_CATCH,
      },
    ]);
    expect(enemies[0]?.state).toBe('stunned');
    expect(enemies[0]?.tile).toEqual({ col: 3, row: 1 });
  });

  it('usa comportamiento ambush apuntando delante de la dirección del jugador', () => {
    const spawns: MazeEnemySpawn[] = [
      {
        id: 'ambush-1',
        kind: 'mute_echo',
        behavior: 'ambush',
        spawn: { col: 7, row: 3 },
        speedTilesPerSec: 3,
      },
    ];
    const map = makeMap(
      [
        '#########',
        '#P      #',
        '# # # # #',
        '#       #',
        '#########',
      ],
      spawns
    );

    const engine = new MazeEngine(map);
    engine.step(0.1, { direction: 'right' });
    const enemies = createEnemyStates(spawns);
    const ctx = createEnemyGridContext(engine.getState(), false);

    stepEnemies(enemies, ctx, 1.0);
    // Se mueve hacia el área superior/izquierda para interceptar delante del jugador
    expect(enemies[0]!.x + enemies[0]!.y).toBeLessThan(10);
    expect(isEnemyWalkableTile(ctx, enemies[0]!.tile.col, enemies[0]!.tile.row)).toBe(true);
  });
});
