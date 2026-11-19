import { describe, expect, it } from 'vitest';
import { CHAPTER_1_MAPS } from '../../data/maps';
import type { MazeMapConfig } from '../../types/campaign';
import { validateMazeMap } from './mapValidator';

describe('mapValidator y mapas del Capítulo 1', () => {
  it('valida todos los mapas del Capítulo 1 (15x11 a 23x15) con alcanzabilidad total', () => {
    expect(CHAPTER_1_MAPS).toHaveLength(5);

    const ids = new Set<string>();
    for (const map of CHAPTER_1_MAPS) {
      expect(ids.has(map.id)).toBe(false);
      ids.add(map.id);

      const result = validateMazeMap(map, {
        minCols: 15,
        maxCols: 23,
        minRows: 11,
        maxRows: 15,
      });

      expect(result.errors, `Errores en ${map.id}`).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('detecta orbes, portales, enemigos inalcanzables y spawns encerrados', () => {
    const blockedOrbMap: MazeMapConfig = {
      id: 'bad-orb',
      cols: 7,
      rows: 5,
      biome: 'beach',
      layout: [
        '#######',
        '#P  #.#',
        '#   # #',
        '#  X# #',
        '#######',
      ],
      syllableTokens: [],
      powerUpPool: [],
      enemies: [],
    };

    const orbRes = validateMazeMap(blockedOrbMap);
    expect(orbRes.valid).toBe(false);
    expect(orbRes.errors.some((e) => e.includes('star_orb'))).toBe(true);

    const blockedPortalAndEnemy: MazeMapConfig = {
      id: 'bad-portal-enemy',
      cols: 7,
      rows: 5,
      biome: 'beach',
      layout: [
        '#######',
        '#P S#X#',
        '#   # #',
        '#   # #',
        '#######',
      ],
      syllableTokens: ['SA'],
      powerUpPool: [],
      enemies: [
        {
          id: 'e1',
          kind: 'sleepy_shadow',
          behavior: 'patrol',
          spawn: { col: 5, row: 2 },
          speedTilesPerSec: 2,
        },
      ],
    };

    const portalRes = validateMazeMap(blockedPortalAndEnemy);
    expect(portalRes.valid).toBe(false);
    expect(portalRes.errors.some((e) => e.includes("portal 'X'"))).toBe(true);
    expect(portalRes.errors.some((e) => e.includes('enemigo "e1"'))).toBe(true);

    const trappedSpawnMap: MazeMapConfig = {
      id: 'trapped',
      cols: 5,
      rows: 5,
      biome: 'beach',
      layout: [
        '#####',
        '#P#X#',
        '#####',
        '#   #',
        '#####',
      ],
      syllableTokens: [],
      powerUpPool: [],
      enemies: [],
    };
    const trappedRes = validateMazeMap(trappedSpawnMap);
    expect(trappedRes.valid).toBe(false);
    expect(trappedRes.errors.some((e) => e.includes('encerrado'))).toBe(true);
  });

  it('permite alcanzar zonas separadas cuando existe una pareja de túneles warp', () => {
    const warpMap: MazeMapConfig = {
      id: 'valid-warp',
      cols: 9,
      rows: 5,
      biome: 'beach',
      layout: [
        '#########',
        '#P 1#2.X#',
        '#   #   #',
        '#  S#   #',
        '#########',
      ],
      syllableTokens: ['LU'],
      powerUpPool: [],
      enemies: [],
    };

    const res = validateMazeMap(warpMap);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });
});
