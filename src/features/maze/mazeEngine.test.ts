import { describe, expect, it } from 'vitest';
import type { MazeMapConfig } from '../../types/campaign';
import {
  DEFAULT_BUBBLE_FUSE_MS,
  DEFAULT_WAVE_DURATION_MS,
  MazeEngine,
  SCORE_BLOCK_BROKEN,
  SCORE_POWER_UP,
  SCORE_STAR_ORB,
  SCORE_SYLLABLE_SEAL,
  parseMazeMap,
} from './mazeEngine';

function createMap(
  layout: string[],
  overrides: Partial<MazeMapConfig> = {}
): MazeMapConfig {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  return {
    id: 'test-map',
    cols,
    rows,
    biome: 'beach',
    layout,
    syllableTokens: [],
    powerUpPool: ['extra_bubble', 'long_wave', 'turbo_boots'],
    enemies: [],
    ...overrides,
  };
}

describe('MazeEngine', () => {
  it('parsea la grilla ASCII, valida dimensiones y asigna sílabas y portales', () => {
    const config = createMap(
      [
        '#######',
        '#P.S K#',
        '#B H ?#',
        '#1 X 2#',
        '#######',
      ],
      { syllableTokens: ['SA', 'PO'] }
    );

    const parsed = parseMazeMap(config);
    expect(parsed.playerSpawn).toEqual({ col: 1, row: 1 });
    expect(parsed.portalPoint).toEqual({ col: 3, row: 3 });
    expect(parsed.warpAPoint).toEqual({ col: 1, row: 3 });
    expect(parsed.warpBPoint).toEqual({ col: 5, row: 3 });
    expect(parsed.totalOrbs).toBe(1);
    expect(parsed.totalSeals).toBe(2);

    const engine = new MazeEngine(config);
    expect(engine.getTile(1, 2)?.kind).toBe('soft_block');
    expect(engine.getTile(3, 2)?.kind).toBe('hard_block');
    expect(engine.getTile(3, 2)?.hp).toBe(2);
    expect(engine.getState().portalOpen).toBe(false);

    expect(() =>
      parseMazeMap(
        createMap(['###', '# #', '###'])
      )
    ).toThrow(/spawn/i);
  });

  it('detiene al jugador contra muros/bloques y aplica giro asistido en esquinas', () => {
    const config = createMap(
      [
        '#######',
        '#P  ###',
        '## ####',
        '##    #',
        '#######',
      ],
      {}
    );

    const engine = new MazeEngine(config, {
      playerSpeedTilesPerSec: 4,
      cornerAssistTolerance: 0.45,
    });

    // Avanzar derecha hasta chocar contra la pared en (4, 1): x debe quedar en 3.0
    engine.step(2, { direction: 'right' });
    expect(engine.getPlayerState().x).toBeCloseTo(3, 5);
    expect(engine.getPlayerState().y).toBeCloseTo(1, 5);

    // Retroceder ligeramente para quedar en x = 2.28 (desfasado +0.28 respecto de la columna 2)
    engine.step(0.18, { direction: 'left' });
    const midX = engine.getPlayerState().x;
    expect(midX).toBeGreaterThan(2.0);
    expect(midX).toBeLessThan(2.4);

    // Al pedir 'down', el giro asistido alinea x -> 2 y baja por el pasillo (2, 2) -> (2, 3)
    engine.step(0.6, { direction: 'down' });
    const afterTurn = engine.getPlayerState();
    expect(afterTurn.x).toBeCloseTo(2, 5);
    expect(afterTurn.y).toBeGreaterThan(2.5);
  });

  it('permite salir de una burbuja recién puesta y bloquea el regreso hasta que detone', () => {
    const config = createMap([
      '#######',
      '#P    #',
      '#######',
    ]);

    const engine = new MazeEngine(config, { playerSpeedTilesPerSec: 4 });
    const placed = engine.step(0, { placeBubble: true });
    expect(placed.events).toHaveLength(1);
    expect(placed.snapshot.activeBubbles).toHaveLength(1);

    // No puede colocar segunda burbuja encima ni superar maxBubbles=1
    expect(engine.placeBubble()).toBeNull();

    // Avanza 1.1 tiles hacia la derecha saliendo de (1, 1) hacia (2, 1)
    engine.step(0.3, { direction: 'right' });
    expect(engine.getPlayerState().x).toBeCloseTo(2.2, 5);
    expect(engine.getActiveBubbles()[0]?.passableByPlayer).toBe(false);

    // Al intentar volver a la izquierda, la burbuja en (1, 1) actúa como obstáculo sólido en x = 2.0
    engine.step(0.5, { direction: 'left' });
    expect(engine.getPlayerState().x).toBeCloseTo(2, 5);
  });

  it('propaga onda en cruz que respeta muros, rompe bloques blandos/duros y detona en cadena', () => {
    const config = createMap(
      [
        '#########',
        '#P  B  ##',
        '# # # ###',
        '#   H K##',
        '#   ?  ##',
        '#########',
      ],
      {
        syllableTokens: ['LU'],
        powerUpPool: ['long_wave'],
      }
    );

    const engine = new MazeEngine(config, {
      playerSpeedTilesPerSec: 4,
      initialMaxBubbles: 2,
      initialWaveRange: 2,
      bubbleFuseMs: DEFAULT_BUBBLE_FUSE_MS,
      waveDurationMs: DEFAULT_WAVE_DURATION_MS,
    });

    // Mover jugador a (3, 1) y colocar burbuja (rango 2)
    engine.step(0.5, { direction: 'right' });
    expect(engine.getPlayerState().tile).toEqual({ col: 3, row: 1 });
    engine.placeBubble();

    // Bajar a (3, 3) y colocar segunda burbuja antes de que explote la primera
    engine.step(0.5, { direction: 'down' });
    expect(engine.getPlayerState().tile).toEqual({ col: 3, row: 3 });
    // Retroceder a (2, 3) para estar junto a H(4,3)
    engine.step(0.25, { direction: 'left' });
    // Mover a (3, 3) y poner burbuja en (3, 2) -> mejor en (3, 2) para probar reacción en cadena con (3, 1)
    engine.step(0.25, { direction: 'right' });
    engine.step(0.25, { direction: 'up' });
    expect(engine.getPlayerState().tile).toEqual({ col: 3, row: 2 });
    engine.placeBubble();

    // Avanzar justo hasta que explote la primera burbuja en (3, 1) (quedaban 2200 - 1250 = 950ms)
    const boom = engine.step(1.0, {});
    const waves = boom.events.filter((ev) => ev.type === 'wave_triggered');

    // La primera burbuja en (3, 1) alcanzó a (3, 2) y detonó en cadena a la segunda burbuja
    expect(waves).toHaveLength(2);

    const wave1 = waves[0];
    if (wave1?.type === 'wave_triggered') {
      const keys = new Set(wave1.wave.tiles.map((t) => `${t.col},${t.row}`));
      // Derecha: rompe B en (4, 1) y NO traspasa a (5, 1)
      expect(keys.has('4,1')).toBe(true);
      expect(keys.has('5,1')).toBe(false);
      // Izquierda: pasa por (2, 1) y (1, 1)
      expect(keys.has('2,1')).toBe(true);
      expect(keys.has('1,1')).toBe(true);
      // Arriba: muro en (3, 0) frena antes de entrar
      expect(keys.has('3,0')).toBe(false);
    }

    // B en (4, 1) quedó destruido
    expect(engine.getTile(4, 1)?.kind).toBe('floor');

    // Ahora probar bloque duro H en (4, 3) (2 golpes) y bloque K(6, 3) / ?(4, 4)
    // Mover jugador a (3, 3) y poner 2 burbujas secuenciales para romper H(4, 3)
    engine.step(0.25, { direction: 'down' });
    expect(engine.getPlayerState().tile).toEqual({ col: 3, row: 3 });

    engine.placeBubble();
    engine.step(2.5, {}); // explota golpe 1 contra H(4, 3) y rompe ?(4, 4)? No, ?(4,4) está en col 4 row 4, no en cruz de (3,3)
    expect(engine.getTile(4, 3)?.kind).toBe('hard_block');
    expect(engine.getTile(4, 3)?.hp).toBe(1);

    engine.placeBubble();
    const secondHit = engine.step(2.3, {});
    expect(engine.getTile(4, 3)?.kind).toBe('floor');
    expect(
      secondHit.events.some(
        (ev) => ev.type === 'block_damaged' && ev.point.col === 4 && ev.point.row === 3 && ev.destroyed
      )
    ).toBe(true);
    expect(engine.getPlayerState().score).toBeGreaterThanOrEqual(SCORE_BLOCK_BROKEN * 2);
  });

  it('revela sílabas ocultas y power-ups al romper bloques, recolecta todo y abre el portal', () => {
    const config = createMap(
      [
        '#########',
        '#P.S K?X#',
        '#########',
      ],
      {
        syllableTokens: ['MA', 'PA'],
        powerUpPool: ['extra_bubble', 'long_wave'],
      }
    );

    const engine = new MazeEngine(config, {
      playerSpeedTilesPerSec: 4,
      initialMaxBubbles: 1,
      initialWaveRange: 2,
    });

    // Recoge star_orb en (2, 1) y syllable_seal 'MA' en (3, 1)
    const walk1 = engine.step(0.75, { direction: 'right' });
    expect(walk1.snapshot.player.tile).toEqual({ col: 4, row: 1 });
    expect(walk1.snapshot.collectedOrbs).toBe(1);
    expect(walk1.snapshot.collectedTokens).toEqual(['MA']);
    expect(walk1.snapshot.portalOpen).toBe(false);

    // Pone burbuja en (4, 1) con rango 2 para romper K en (5, 1)
    engine.placeBubble();
    engine.step(0.5, { direction: 'left' });
    const det1 = engine.step(2.0, {});

    // K en (5, 1) revela el sello oculto 'PA' y NO lo destruye
    expect(engine.getTile(5, 1)?.kind).toBe('floor');
    expect(
      det1.events.some(
        (ev) =>
          ev.type === 'item_revealed' &&
          ev.collectible.kind === 'syllable_seal' &&
          ev.collectible.token === 'PA'
      )
    ).toBe(true);

    // Avanzar a (5, 1) para recoger 'PA' -> se abre el portal!
    const pickSeal2 = engine.step(0.75, { direction: 'right' });
    expect(pickSeal2.snapshot.collectedTokens).toEqual(['MA', 'PA']);
    expect(pickSeal2.snapshot.portalOpen).toBe(true);
    expect(pickSeal2.events.some((ev) => ev.type === 'portal_opened')).toBe(true);

    // Romper '?' en (6, 1) -> revela power-up 'extra_bubble'
    engine.placeBubble();
    engine.step(0.5, { direction: 'left' });
    const det2 = engine.step(2.0, {});
    expect(engine.getTile(6, 1)?.kind).toBe('floor');
    expect(
      det2.events.some(
        (ev) =>
          ev.type === 'item_revealed' &&
          ev.collectible.kind === 'power_up' &&
          ev.collectible.powerUpKind === 'extra_bubble'
      )
    ).toBe(true);

    // Cruzar (6, 1) recogiendo power-up y entrar al portal X en (7, 1)
    const finish = engine.step(1.0, { direction: 'right' });
    expect(finish.snapshot.player.maxBubbles).toBe(2);
    expect(finish.snapshot.portalEntered).toBe(true);
    expect(finish.events.some((ev) => ev.type === 'powerup_collected')).toBe(true);
    expect(finish.events.some((ev) => ev.type === 'portal_entered')).toBe(true);
    expect(finish.snapshot.score).toBe(
      SCORE_STAR_ORB +
        SCORE_SYLLABLE_SEAL * 2 +
        SCORE_BLOCK_BROKEN * 2 +
        SCORE_POWER_UP
    );
  });

  it('teletransporta entre warp_a y warp_b sin bucles y mantiene determinismo', () => {
    const config = createMap([
      '#########',
      '#1 P   2#',
      '#########',
    ]);

    const runSequence = () => {
      const eng = new MazeEngine(config, { playerSpeedTilesPerSec: 4 });
      const res1 = eng.step(0.5, { direction: 'left' }); // llega a (1, 1) -> warp_a -> teletransporta a (7, 1)
      const afterWarp = eng.getPlayerState().tile;
      // Continúa hacia la izquierda saliendo del destino (7, 1) -> (6, 1)
      eng.step(0.25, { direction: 'left' });
      return {
        warpedEvents: res1.events.filter((e) => e.type === 'warped'),
        afterWarp,
        finalSnapshot: eng.getState(),
      };
    };

    const runA = runSequence();
    const runB = runSequence();

    expect(runA.warpedEvents).toEqual([{ type: 'warped', from: { col: 1, row: 1 }, to: { col: 7, row: 1 } }]);
    expect(runA.afterWarp).toEqual({ col: 7, row: 1 });
    expect(runA.finalSnapshot.player.tile).toEqual({ col: 6, row: 1 });
    expect(runA.finalSnapshot).toEqual(runB.finalSnapshot);
  });
});
