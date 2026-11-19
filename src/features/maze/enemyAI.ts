import type {
  EnemyBehavior,
  EnemyBehaviorState,
  EnemyKind,
  GridPoint,
  MazeEnemySpawn,
  MazeTileKind,
  MoveDirection,
} from '../../types/campaign';
import { isTileSolidKind, type MazeEngineSnapshot } from './mazeEngine';

export const DEFAULT_ENEMY_STUN_MS = 3500;
export const DEFAULT_ENEMY_RESPAWN_STUN_MS = 1800;
export const DEFAULT_LOS_RANGE = 6;
export const AMBUSH_LOOKAHEAD_TILES = 3;
export const AMBUSH_ACTIVATION_DISTANCE = 9;
export const CHASE_SPEED_MULTIPLIER = 1.12;
export const FRIGHTENED_SPEED_MULTIPLIER = 0.72;
export const ENEMY_CONTACT_RADIUS = 0.58;

export const SCORE_STUN_ENEMY = 40;
export const SCORE_SCARE_CATCH = 100;

const EPS = 1e-5;
const MAX_SUBSTEP_SEC = 1 / 60;

type CardinalDirection = Exclude<MoveDirection, 'none'>;

const CARDINAL_LIST: ReadonlyArray<{ dir: CardinalDirection; dc: number; dr: number }> = [
  { dir: 'up', dc: 0, dr: -1 },
  { dir: 'right', dc: 1, dr: 0 },
  { dir: 'down', dc: 0, dr: 1 },
  { dir: 'left', dc: -1, dr: 0 },
];

export interface EnemyGridContext {
  cols: number;
  rows: number;
  tiles: MazeTileKind[][];
  activeBubbles: ReadonlyArray<{ col: number; row: number }>;
  activeWaves: ReadonlyArray<{ tiles: ReadonlyArray<GridPoint> }>;
  playerX: number;
  playerY: number;
  playerTile: GridPoint;
  playerFacing: MoveDirection;
  frightenedActive: boolean;
}

export interface EnemyRuntimeState {
  id: string;
  kind: EnemyKind;
  behavior: EnemyBehavior;
  state: EnemyBehaviorState;
  spawn: GridPoint;
  x: number;
  y: number;
  tile: GridPoint;
  facing: MoveDirection;
  speedTilesPerSec: number;
  stunRemainingMs: number;
  alertedByLos: boolean;
  lastKnownTarget: GridPoint | null;
  decisionCounter: number;
}

export type EnemyAIEvent =
  | { type: 'enemy_stunned'; enemyId: string; point: GridPoint; scoreGained: number }
  | { type: 'enemy_recovered'; enemyId: string }
  | { type: 'enemy_frightened_started'; enemyId: string }
  | { type: 'enemy_caught_frightened'; enemyId: string; point: GridPoint; scoreGained: number }
  | { type: 'player_touched_enemy'; enemyId: string; point: GridPoint };

/**
 * Construye el contexto de grilla que necesita la IA a partir de un snapshot de `MazeEngine`.
 */
export function createEnemyGridContext(
  snapshot: MazeEngineSnapshot,
  frightenedActive: boolean
): EnemyGridContext {
  return {
    cols: snapshot.cols,
    rows: snapshot.rows,
    tiles: snapshot.tiles,
    activeBubbles: snapshot.activeBubbles.map((b) => ({ col: b.col, row: b.row })),
    activeWaves: snapshot.activeWaves.map((w) => ({ tiles: w.tiles })),
    playerX: snapshot.player.x,
    playerY: snapshot.player.y,
    playerTile: snapshot.player.tile,
    playerFacing: snapshot.player.facing,
    frightenedActive,
  };
}

/**
 * Inicializa estados de runtime deterministas desde los spawns declarados en el mapa.
 */
export function createEnemyStates(spawns: ReadonlyArray<MazeEnemySpawn>): EnemyRuntimeState[] {
  return spawns.map((spawn, idx) => ({
    id: spawn.id,
    kind: spawn.kind,
    behavior: spawn.behavior,
    state: 'normal',
    spawn: { ...spawn.spawn },
    x: spawn.spawn.col,
    y: spawn.spawn.row,
    tile: { ...spawn.spawn },
    facing: CARDINAL_LIST[idx % CARDINAL_LIST.length]?.dir ?? 'left',
    speedTilesPerSec: Math.max(0.5, spawn.speedTilesPerSec),
    stunRemainingMs: 0,
    alertedByLos: false,
    lastKnownTarget: null,
    decisionCounter: idx,
  }));
}

export function canEnemyHarmPlayer(enemy: EnemyRuntimeState): boolean {
  return enemy.state === 'normal';
}

function directionOffset(dir: MoveDirection): { dc: number; dr: number } {
  switch (dir) {
    case 'up':
      return { dc: 0, dr: -1 };
    case 'right':
      return { dc: 1, dr: 0 };
    case 'down':
      return { dc: 0, dr: 1 };
    case 'left':
      return { dc: -1, dr: 0 };
    case 'none':
      return { dc: 0, dr: 0 };
  }
}

function oppositeDirection(dir: MoveDirection): MoveDirection {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'none':
      return 'none';
  }
}

function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function isEnemyWalkableTile(
  ctx: EnemyGridContext,
  col: number,
  row: number,
  ignoreBubbles = false
): boolean {
  if (col < 0 || col >= ctx.cols || row < 0 || row >= ctx.rows) return false;
  const kind = ctx.tiles[row]?.[col];
  if (!kind || isTileSolidKind(kind)) return false;

  if (!ignoreBubbles) {
    const hasBubble = ctx.activeBubbles.some((b) => b.col === col && b.row === row);
    if (hasBubble) return false;
  }
  return true;
}

/**
 * Comprueba línea de vista cardinal libre de muros y bloques entre dos celdas.
 */
export function hasLineOfSight(
  ctx: EnemyGridContext,
  from: GridPoint,
  to: GridPoint,
  maxRange = DEFAULT_LOS_RANGE
): boolean {
  if (from.col !== to.col && from.row !== to.row) return false;
  const dist = manhattan(from, to);
  if (dist === 0 || dist > maxRange) return false;

  const dc = Math.sign(to.col - from.col);
  const dr = Math.sign(to.row - from.row);

  for (let step = 1; step < dist; step += 1) {
    const col = from.col + dc * step;
    const row = from.row + dr * step;
    const kind = ctx.tiles[row]?.[col];
    if (!kind || isTileSolidKind(kind)) {
      return false;
    }
  }
  return true;
}

function getValidCardinalDirs(
  ctx: EnemyGridContext,
  tile: GridPoint,
  excludeReverseOf: MoveDirection
): CardinalDirection[] {
  const allOpen: CardinalDirection[] = [];
  for (const item of CARDINAL_LIST) {
    if (isEnemyWalkableTile(ctx, tile.col + item.dc, tile.row + item.dr)) {
      allOpen.push(item.dir);
    }
  }
  if (allOpen.length <= 1 || excludeReverseOf === 'none') {
    return allOpen;
  }
  const opposite = oppositeDirection(excludeReverseOf);
  const nonReverse = allOpen.filter((dir) => dir !== opposite);
  return nonReverse.length > 0 ? nonReverse : allOpen;
}

/**
 * Calcula mediante BFS el primer paso válido desde `start` hacia `goal` en la grilla.
 */
export function findNextDirectionBfs(
  ctx: EnemyGridContext,
  start: GridPoint,
  goal: GridPoint,
  preferredFacing: MoveDirection
): CardinalDirection | null {
  if (start.col === goal.col && start.row === goal.row) return null;

  const visited = new Set<string>([`${start.col},${start.row}`]);
  const queue: Array<{ col: number; row: number; firstDir: CardinalDirection }> = [];

  const initialDirs = getValidCardinalDirs(ctx, start, 'none');
  // Ordena priorizando no hacer giro en U salvo necesidad
  const opposite = oppositeDirection(preferredFacing);
  initialDirs.sort((a, b) => {
    if (a === opposite && b !== opposite) return 1;
    if (b === opposite && a !== opposite) return -1;
    if (a === preferredFacing && b !== preferredFacing) return -1;
    if (b === preferredFacing && a !== preferredFacing) return 1;
    return 0;
  });

  for (const dir of initialDirs) {
    const { dc, dr } = directionOffset(dir);
    const nc = start.col + dc;
    const nr = start.row + dr;
    if (nc === goal.col && nr === goal.row) {
      return dir;
    }
    const key = `${nc},${nr}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push({ col: nc, row: nr, firstDir: dir });
    }
  }

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;

    for (const item of CARDINAL_LIST) {
      const nc = node.col + item.dc;
      const nr = node.row + item.dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      if (!isEnemyWalkableTile(ctx, nc, nr)) continue;

      if (nc === goal.col && nr === goal.row) {
        return node.firstDir;
      }
      visited.add(key);
      queue.push({ col: nc, row: nr, firstDir: node.firstDir });
    }
  }

  return null;
}

function resolveAmbushTarget(ctx: EnemyGridContext): GridPoint {
  const { dc, dr } = directionOffset(ctx.playerFacing);
  let target: GridPoint = { ...ctx.playerTile };

  for (let i = 1; i <= AMBUSH_LOOKAHEAD_TILES; i += 1) {
    const nc = ctx.playerTile.col + dc * i;
    const nr = ctx.playerTile.row + dr * i;
    if (isEnemyWalkableTile(ctx, nc, nr, true)) {
      target = { col: nc, row: nr };
    } else {
      break;
    }
  }
  return target;
}

function chooseFrightenedDirection(
  enemy: EnemyRuntimeState,
  ctx: EnemyGridContext,
  candidates: CardinalDirection[]
): CardinalDirection {
  let bestDir = candidates[0] ?? 'left';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const dir of candidates) {
    const { dc, dr } = directionOffset(dir);
    const nextPt = { col: enemy.tile.col + dc, row: enemy.tile.row + dr };
    const dist = manhattan(nextPt, ctx.playerTile);
    const exits = getValidCardinalDirs(ctx, nextPt, dir).length;
    // Prioriza alejarse del jugador y evitar callejones sin salida si hay alternativa
    const score = dist * 10 + exits;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

function choosePatrolDirection(
  enemy: EnemyRuntimeState,
  candidates: CardinalDirection[]
): CardinalDirection {
  if (candidates.length === 1 && candidates[0]) {
    return candidates[0];
  }

  const keepStraight = candidates.includes(enemy.facing as CardinalDirection);
  if (candidates.length === 2 && keepStraight) {
    return enemy.facing as CardinalDirection;
  }

  enemy.decisionCounter += 1;
  const pickIndex = enemy.decisionCounter % candidates.length;
  return candidates[pickIndex] ?? candidates[0] ?? 'left';
}

function chooseNextDirection(enemy: EnemyRuntimeState, ctx: EnemyGridContext): MoveDirection {
  const candidates = getValidCardinalDirs(ctx, enemy.tile, enemy.facing);
  if (candidates.length === 0) return 'none';

  if (enemy.state === 'frightened') {
    return chooseFrightenedDirection(enemy, ctx, candidates);
  }

  // Modo normal: evaluar LoS o emboscada
  if (enemy.behavior === 'chase_los') {
    if (hasLineOfSight(ctx, enemy.tile, ctx.playerTile)) {
      enemy.alertedByLos = true;
      enemy.lastKnownTarget = { ...ctx.playerTile };
    } else if (
      enemy.lastKnownTarget &&
      enemy.tile.col === enemy.lastKnownTarget.col &&
      enemy.tile.row === enemy.lastKnownTarget.row
    ) {
      enemy.alertedByLos = false;
      enemy.lastKnownTarget = null;
    }

    if (enemy.alertedByLos && enemy.lastKnownTarget) {
      const bfsDir = findNextDirectionBfs(ctx, enemy.tile, enemy.lastKnownTarget, enemy.facing);
      if (bfsDir) return bfsDir;
      enemy.alertedByLos = false;
      enemy.lastKnownTarget = null;
    }
  } else if (enemy.behavior === 'ambush') {
    const distToPlayer = manhattan(enemy.tile, ctx.playerTile);
    if (distToPlayer <= AMBUSH_ACTIVATION_DISTANCE || hasLineOfSight(ctx, enemy.tile, ctx.playerTile)) {
      const target = resolveAmbushTarget(ctx);
      const bfsDir = findNextDirectionBfs(ctx, enemy.tile, target, enemy.facing);
      if (bfsDir) return bfsDir;
    }
  }

  return choosePatrolDirection(enemy, candidates);
}

function isTileInActiveWaves(tile: GridPoint, ctx: EnemyGridContext): boolean {
  for (const wave of ctx.activeWaves) {
    for (const pt of wave.tiles) {
      if (pt.col === tile.col && pt.row === tile.row) {
        return true;
      }
    }
  }
  return false;
}

function updateEnemyStatus(
  enemy: EnemyRuntimeState,
  ctx: EnemyGridContext,
  dtMs: number,
  stunDurationMs: number,
  events: EnemyAIEvent[]
): void {
  if (isTileInActiveWaves(enemy.tile, ctx)) {
    const wasStunned = enemy.state === 'stunned';
    enemy.state = 'stunned';
    enemy.stunRemainingMs = Math.max(enemy.stunRemainingMs, stunDurationMs);
    enemy.alertedByLos = false;
    enemy.lastKnownTarget = null;
    if (!wasStunned) {
      events.push({
        type: 'enemy_stunned',
        enemyId: enemy.id,
        point: { ...enemy.tile },
        scoreGained: SCORE_STUN_ENEMY,
      });
    }
    return;
  }

  if (enemy.state === 'stunned') {
    enemy.stunRemainingMs = Math.max(0, enemy.stunRemainingMs - dtMs);
    if (enemy.stunRemainingMs <= 0) {
      enemy.state = ctx.frightenedActive ? 'frightened' : 'normal';
      events.push({ type: 'enemy_recovered', enemyId: enemy.id });
      if (enemy.state === 'frightened') {
        events.push({ type: 'enemy_frightened_started', enemyId: enemy.id });
      }
    }
    return;
  }

  if (ctx.frightenedActive && enemy.state !== 'frightened') {
    enemy.state = 'frightened';
    enemy.alertedByLos = false;
    enemy.lastKnownTarget = null;
    enemy.facing = oppositeDirection(enemy.facing);
    events.push({ type: 'enemy_frightened_started', enemyId: enemy.id });
  } else if (!ctx.frightenedActive && enemy.state === 'frightened') {
    enemy.state = 'normal';
  }
}

function moveEnemySlice(
  enemy: EnemyRuntimeState,
  ctx: EnemyGridContext,
  dtSec: number
): void {
  if (enemy.state === 'stunned') return;

  const mult =
    enemy.state === 'frightened'
      ? FRIGHTENED_SPEED_MULTIPLIER
      : enemy.alertedByLos
        ? CHASE_SPEED_MULTIPLIER
        : 1;

  let remainingDist = enemy.speedTilesPerSec * mult * dtSec;
  let guard = 0;

  while (remainingDist > EPS && guard < 4) {
    guard += 1;

    const atColCenter = Math.abs(enemy.x - Math.round(enemy.x)) <= EPS;
    const atRowCenter = Math.abs(enemy.y - Math.round(enemy.y)) <= EPS;

    if (atColCenter && atRowCenter) {
      enemy.x = Math.round(enemy.x);
      enemy.y = Math.round(enemy.y);
      enemy.tile = { col: enemy.x, row: enemy.y };
      enemy.facing = chooseNextDirection(enemy, ctx);
    }

    if (enemy.facing === 'none') break;

    const { dc, dr } = directionOffset(enemy.facing);
    // Objetivo de centro de celda siguiente en la dirección actual
    const nextCol = dc > 0 ? Math.floor(enemy.x + EPS) + 1 : dc < 0 ? Math.ceil(enemy.x - EPS) - 1 : Math.round(enemy.x);
    const nextRow = dr > 0 ? Math.floor(enemy.y + EPS) + 1 : dr < 0 ? Math.ceil(enemy.y - EPS) - 1 : Math.round(enemy.y);

    if (!isEnemyWalkableTile(ctx, nextCol, nextRow)) {
      // Si apareció una burbuja delante a mitad de celda, retrocede al centro seguro previo
      enemy.facing = oppositeDirection(enemy.facing);
      if (enemy.facing === 'none') break;
      continue;
    }

    const distToCenter = Math.abs(nextCol - enemy.x) + Math.abs(nextRow - enemy.y);
    const step = Math.min(remainingDist, distToCenter);
    enemy.x += dc * step;
    enemy.y += dr * step;
    remainingDist -= step;

    if (Math.abs(enemy.x - nextCol) <= EPS && Math.abs(enemy.y - nextRow) <= EPS) {
      enemy.x = nextCol;
      enemy.y = nextRow;
    }

    enemy.tile = { col: Math.round(enemy.x), row: Math.round(enemy.y) };
  }
}

/**
 * Evalúa contactos jugador-enemigo según estado (`normal` daña suavemente, `frightened` captura y reubica).
 */
export function resolveEnemyContacts(
  enemies: EnemyRuntimeState[],
  ctx: EnemyGridContext,
  respawnStunMs = DEFAULT_ENEMY_RESPAWN_STUN_MS
): EnemyAIEvent[] {
  const events: EnemyAIEvent[] = [];

  for (const enemy of enemies) {
    if (enemy.state === 'stunned') continue;
    const dist = Math.hypot(enemy.x - ctx.playerX, enemy.y - ctx.playerY);
    if (dist > ENEMY_CONTACT_RADIUS) continue;

    if (enemy.state === 'frightened') {
      const catchPoint = { ...enemy.tile };
      enemy.x = enemy.spawn.col;
      enemy.y = enemy.spawn.row;
      enemy.tile = { ...enemy.spawn };
      enemy.state = 'stunned';
      enemy.stunRemainingMs = respawnStunMs;
      enemy.alertedByLos = false;
      enemy.lastKnownTarget = null;
      events.push({
        type: 'enemy_caught_frightened',
        enemyId: enemy.id,
        point: catchPoint,
        scoreGained: SCORE_SCARE_CATCH,
      });
    } else if (canEnemyHarmPlayer(enemy)) {
      events.push({
        type: 'player_touched_enemy',
        enemyId: enemy.id,
        point: { ...enemy.tile },
      });
    }
  }

  return events;
}

/**
 * Avanza la IA de todos los enemigos durante `dtSec` segundos en subpasos deterministas.
 */
export function stepEnemies(
  enemies: EnemyRuntimeState[],
  ctx: EnemyGridContext,
  dtSec: number,
  stunDurationMs = DEFAULT_ENEMY_STUN_MS
): EnemyAIEvent[] {
  const events: EnemyAIEvent[] = [];
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    return events;
  }

  let remainingSec = dtSec;
  while (remainingSec > EPS) {
    const sliceSec = Math.min(remainingSec, MAX_SUBSTEP_SEC);
    remainingSec -= sliceSec;
    const sliceMs = sliceSec * 1000;

    for (const enemy of enemies) {
      updateEnemyStatus(enemy, ctx, sliceMs, stunDurationMs, events);
      moveEnemySlice(enemy, ctx, sliceSec);
    }
  }

  return events;
}
