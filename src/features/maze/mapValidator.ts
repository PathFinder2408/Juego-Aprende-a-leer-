import type { GridPoint, MazeMapConfig } from '../../types/campaign';
import { isTileSolidKind, parseMazeMap, type MazeTileState } from './mazeEngine';

export interface MapValidationOptions {
  minCols?: number;
  minRows?: number;
  maxCols?: number;
  maxRows?: number;
}

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
}

const CARDINAL_DIRS: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];

function pointKey(pt: GridPoint): string {
  return `${pt.col},${pt.row}`;
}

function collectReachableKeys(
  tiles: MazeTileState[][],
  cols: number,
  rows: number,
  start: GridPoint,
  warpA: GridPoint | null,
  warpB: GridPoint | null
): Set<string> {
  const visited = new Set<string>();
  const queue: GridPoint[] = [start];
  visited.add(pointKey(start));

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) continue;

    for (const { dc, dr } of CARDINAL_DIRS) {
      const nc = curr.col + dc;
      const nr = curr.row + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

      const tile = tiles[nr]?.[nc];
      if (!tile || tile.kind === 'wall') continue;

      const key = `${nc},${nr}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ col: nc, row: nr });
      }
    }

    if (warpA && warpB && curr.col === warpA.col && curr.row === warpA.row) {
      const bKey = pointKey(warpB);
      if (!visited.has(bKey)) {
        visited.add(bKey);
        queue.push({ ...warpB });
      }
    } else if (warpA && warpB && curr.col === warpB.col && curr.row === warpB.row) {
      const aKey = pointKey(warpA);
      if (!visited.has(aKey)) {
        visited.add(aKey);
        queue.push({ ...warpA });
      }
    }
  }

  return visited;
}

/**
 * Valida estructura, spawns y alcanzabilidad BFS de un mapa de laberinto JSON.
 */
export function validateMazeMap(
  config: MazeMapConfig,
  options: MapValidationOptions = {}
): MapValidationResult {
  const errors: string[] = [];

  if (options.minCols !== undefined && config.cols < options.minCols) {
    errors.push(`Mapa "${config.id}": cols=${config.cols} es menor al mínimo ${options.minCols}`);
  }
  if (options.maxCols !== undefined && config.cols > options.maxCols) {
    errors.push(`Mapa "${config.id}": cols=${config.cols} supera el máximo ${options.maxCols}`);
  }
  if (options.minRows !== undefined && config.rows < options.minRows) {
    errors.push(`Mapa "${config.id}": rows=${config.rows} es menor al mínimo ${options.minRows}`);
  }
  if (options.maxRows !== undefined && config.rows > options.maxRows) {
    errors.push(`Mapa "${config.id}": rows=${config.rows} supera el máximo ${options.maxRows}`);
  }

  let parsed: ReturnType<typeof parseMazeMap>;
  try {
    parsed = parseMazeMap(config);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { valid: false, errors };
  }

  if (parsed.totalSeals !== config.syllableTokens.length) {
    errors.push(
      `Mapa "${config.id}": tiene ${parsed.totalSeals} sellos ('S'/'K') pero ${config.syllableTokens.length} syllableTokens`
    );
  }

  if (!parsed.portalPoint) {
    errors.push(`Mapa "${config.id}": falta portal de salida ('X')`);
  }

  if ((parsed.warpAPoint === null) !== (parsed.warpBPoint === null)) {
    errors.push(`Mapa "${config.id}": los túneles warp '1' y '2' deben aparecer en pareja`);
  }

  // Verificar que el jugador tenga al menos 1 celda transitable adyacente al spawn
  const hasAdjacentFloor = CARDINAL_DIRS.some(({ dc, dr }) => {
    const t = parsed.tiles[parsed.playerSpawn.row + dr]?.[parsed.playerSpawn.col + dc];
    return t !== undefined && !isTileSolidKind(t.kind);
  });
  if (!hasAdjacentFloor) {
    errors.push(`Mapa "${config.id}": el spawn del jugador está encerrado sin salida libre`);
  }

  const reachable = collectReachableKeys(
    parsed.tiles,
    config.cols,
    config.rows,
    parsed.playerSpawn,
    parsed.warpAPoint,
    parsed.warpBPoint
  );

  for (const item of parsed.collectibles) {
    if (!reachable.has(`${item.col},${item.row}`)) {
      errors.push(
        `Mapa "${config.id}": coleccionable ${item.kind} en (${item.col}, ${item.row}) no es alcanzable`
      );
    }
  }

  // Verificar sellos ocultos ('K')
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      const tile = parsed.tiles[row]?.[col];
      if (tile?.hiddenSealToken !== undefined && !reachable.has(`${col},${row}`)) {
        errors.push(
          `Mapa "${config.id}": sello oculto 'K' en (${col}, ${row}) no es alcanzable`
        );
      }
    }
  }

  if (parsed.portalPoint && !reachable.has(pointKey(parsed.portalPoint))) {
    errors.push(
      `Mapa "${config.id}": portal 'X' en (${parsed.portalPoint.col}, ${parsed.portalPoint.row}) no es alcanzable`
    );
  }

  for (const enemy of config.enemies) {
    const tile = parsed.tiles[enemy.spawn.row]?.[enemy.spawn.col];
    if (!tile || isTileSolidKind(tile.kind)) {
      errors.push(
        `Mapa "${config.id}": enemigo "${enemy.id}" spawnea sobre muro/bloque en (${enemy.spawn.col}, ${enemy.spawn.row})`
      );
      continue;
    }
    if (
      enemy.spawn.col === parsed.playerSpawn.col &&
      enemy.spawn.row === parsed.playerSpawn.row
    ) {
      errors.push(`Mapa "${config.id}": enemigo "${enemy.id}" coincide con el spawn del jugador`);
    }
    if (!reachable.has(pointKey(enemy.spawn))) {
      errors.push(
        `Mapa "${config.id}": spawn de enemigo "${enemy.id}" en (${enemy.spawn.col}, ${enemy.spawn.row}) no es alcanzable`
      );
    }
  }

  if (config.bossSpawn) {
    const bossTile = parsed.tiles[config.bossSpawn.row]?.[config.bossSpawn.col];
    if (!bossTile || isTileSolidKind(bossTile.kind)) {
      errors.push(
        `Mapa "${config.id}": bossSpawn (${config.bossSpawn.col}, ${config.bossSpawn.row}) cae sobre muro/bloque`
      );
    } else if (!reachable.has(pointKey(config.bossSpawn))) {
      errors.push(
        `Mapa "${config.id}": bossSpawn (${config.bossSpawn.col}, ${config.bossSpawn.row}) no es alcanzable`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
