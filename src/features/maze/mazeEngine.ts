import type {
  BiomeId,
  GridPoint,
  MazeMapConfig,
  MazeTileKind,
  MoveDirection,
  PowerUpKind,
} from '../../types/campaign';

export const MAZE_CHAR_LEGEND = {
  '#': 'wall',
  B: 'soft_block',
  '?': 'soft_block_powerup',
  K: 'soft_block_seal',
  H: 'hard_block',
  ' ': 'floor',
  '.': 'star_orb',
  S: 'syllable_seal',
  P: 'player_spawn',
  X: 'portal',
  '1': 'warp_a',
  '2': 'warp_b',
} as const;

export const DEFAULT_PLAYER_SPEED_TILES_PER_SEC = 4.2;
export const DEFAULT_BUBBLE_FUSE_MS = 2200;
export const DEFAULT_WAVE_DURATION_MS = 450;
export const DEFAULT_INITIAL_MAX_BUBBLES = 1;
export const DEFAULT_INITIAL_WAVE_RANGE = 1;
export const DEFAULT_CORNER_ASSIST_TOLERANCE = 0.45;
export const DEFAULT_POWERUP_DROP_INTERVAL = 3;

export const MAX_BUBBLES_CAP = 5;
export const MAX_WAVE_RANGE_CAP = 6;
export const TURBO_SPEED_MULTIPLIER = 1.3;

export const SCORE_STAR_ORB = 10;
export const SCORE_SYLLABLE_SEAL = 50;
export const SCORE_POWER_UP = 25;
export const SCORE_BLOCK_BROKEN = 5;

const EPS = 1e-5;
const MAX_SUBSTEP_SEC = 1 / 60;
const BUBBLE_EXIT_THRESHOLD = 0.95;

const CARDINAL_OFFSETS: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];

export interface MazeTileState {
  col: number;
  row: number;
  kind: MazeTileKind;
  hp: number;
  maxHp: number;
  hiddenSealToken?: string;
  guaranteedPowerUp?: boolean;
}

export type MazeCollectibleKind = 'star_orb' | 'syllable_seal' | 'power_up';

export interface MazeCollectible {
  id: string;
  kind: MazeCollectibleKind;
  col: number;
  row: number;
  token?: string;
  powerUpKind?: PowerUpKind;
}

export interface ActiveBubble {
  id: string;
  col: number;
  row: number;
  fuseMs: number;
  remainingMs: number;
  range: number;
  passableByPlayer: boolean;
}

export interface ActiveWave {
  id: string;
  origin: GridPoint;
  tiles: GridPoint[];
  remainingMs: number;
}

export interface MazePlayerState {
  x: number;
  y: number;
  tile: GridPoint;
  facing: MoveDirection;
  speedTilesPerSec: number;
  speedMultiplier: number;
  maxBubbles: number;
  waveRange: number;
  score: number;
}

export interface MazeStepInput {
  direction?: MoveDirection;
  placeBubble?: boolean;
}

export type MazeEvent =
  | { type: 'bubble_placed'; bubble: ActiveBubble }
  | { type: 'wave_triggered'; wave: ActiveWave; brokenBlocks: GridPoint[] }
  | { type: 'block_damaged'; point: GridPoint; remainingHp: number; destroyed: boolean }
  | { type: 'orb_collected'; point: GridPoint; scoreGained: number }
  | {
      type: 'seal_collected';
      point: GridPoint;
      token: string;
      collectedSeals: number;
      totalSeals: number;
      scoreGained: number;
    }
  | { type: 'powerup_collected'; point: GridPoint; kind: PowerUpKind; scoreGained: number }
  | { type: 'item_revealed'; point: GridPoint; collectible: MazeCollectible }
  | { type: 'portal_opened'; point: GridPoint | null }
  | { type: 'portal_entered'; point: GridPoint }
  | { type: 'warped'; from: GridPoint; to: GridPoint };

export interface MazeEngineOptions {
  playerSpawn?: GridPoint;
  playerSpeedTilesPerSec?: number;
  bubbleFuseMs?: number;
  waveDurationMs?: number;
  initialMaxBubbles?: number;
  initialWaveRange?: number;
  cornerAssistTolerance?: number;
  powerUpDropEveryNBlocks?: number;
}

export interface MazeEngineSnapshot {
  mapId: string;
  biome: BiomeId;
  cols: number;
  rows: number;
  player: MazePlayerState;
  tiles: MazeTileKind[][];
  collectibles: MazeCollectible[];
  activeBubbles: ActiveBubble[];
  activeWaves: ActiveWave[];
  collectedOrbs: number;
  totalOrbs: number;
  collectedSeals: number;
  totalSeals: number;
  collectedTokens: string[];
  portalPoint: GridPoint | null;
  portalOpen: boolean;
  portalEntered: boolean;
  score: number;
}

export interface MazeStepResult {
  events: MazeEvent[];
  snapshot: MazeEngineSnapshot;
}

export interface ParsedMazeMap {
  tiles: MazeTileState[][];
  collectibles: MazeCollectible[];
  playerSpawn: GridPoint;
  portalPoint: GridPoint | null;
  warpAPoint: GridPoint | null;
  warpBPoint: GridPoint | null;
  totalOrbs: number;
  totalSeals: number;
}

/**
 * Parsea la grilla ASCII de un `MazeMapConfig` en estado inicial determinista.
 */
export function parseMazeMap(config: MazeMapConfig, spawnOverride?: GridPoint): ParsedMazeMap {
  if (config.cols <= 0 || config.rows <= 0) {
    throw new Error(`Dimensiones inválidas en mapa "${config.id}": ${config.cols}x${config.rows}`);
  }
  if (config.layout.length !== config.rows) {
    throw new Error(
      `El mapa "${config.id}" define rows=${config.rows} pero layout tiene ${config.layout.length} filas`
    );
  }

  const tiles: MazeTileState[][] = [];
  const collectibles: MazeCollectible[] = [];

  let playerSpawn: GridPoint | null = spawnOverride ? { ...spawnOverride } : null;
  let portalPoint: GridPoint | null = null;
  let warpAPoint: GridPoint | null = null;
  let warpBPoint: GridPoint | null = null;
  let sealCursor = 0;
  let collectibleCounter = 0;
  let totalOrbs = 0;

  for (let row = 0; row < config.rows; row += 1) {
    const line = config.layout[row];
    if (line === undefined || line.length !== config.cols) {
      throw new Error(
        `Fila ${row} del mapa "${config.id}" tiene longitud ${line?.length ?? 0}, se esperaba ${config.cols}`
      );
    }

    const rowTiles: MazeTileState[] = [];
    for (let col = 0; col < config.cols; col += 1) {
      const ch = line[col] ?? ' ';
      const tile = createTileFromChar(ch, col, row, config.id);

      if (ch === 'P') {
        if (!spawnOverride && playerSpawn !== null) {
          throw new Error(`El mapa "${config.id}" tiene múltiples spawns de jugador ('P')`);
        }
        if (!spawnOverride) {
          playerSpawn = { col, row };
        }
      } else if (ch === 'X') {
        portalPoint = { col, row };
      } else if (ch === '1') {
        warpAPoint = { col, row };
      } else if (ch === '2') {
        warpBPoint = { col, row };
      } else if (ch === '.') {
        collectibleCounter += 1;
        totalOrbs += 1;
        collectibles.push({
          id: `orb-${collectibleCounter}`,
          kind: 'star_orb',
          col,
          row,
        });
      } else if (ch === 'S' || ch === 'K') {
        const token = config.syllableTokens[sealCursor];
        if (token === undefined) {
          throw new Error(
            `El mapa "${config.id}" tiene más marcadores de sílaba ('S'/'K') que syllableTokens`
          );
        }
        sealCursor += 1;
        if (ch === 'S') {
          collectibleCounter += 1;
          collectibles.push({
            id: `seal-${collectibleCounter}`,
            kind: 'syllable_seal',
            col,
            row,
            token,
          });
        } else {
          tile.hiddenSealToken = token;
        }
      }

      rowTiles.push(tile);
    }
    tiles.push(rowTiles);
  }

  if (playerSpawn === null) {
    throw new Error(`El mapa "${config.id}" no define spawn del jugador ('P')`);
  }

  const spawnTile = tiles[playerSpawn.row]?.[playerSpawn.col];
  if (!spawnTile || isTileSolidKind(spawnTile.kind)) {
    throw new Error(
      `El spawn (${playerSpawn.col}, ${playerSpawn.row}) en "${config.id}" cae sobre un muro o fuera de rango`
    );
  }

  return {
    tiles,
    collectibles,
    playerSpawn,
    portalPoint,
    warpAPoint,
    warpBPoint,
    totalOrbs,
    totalSeals: sealCursor,
  };
}

function createTileFromChar(ch: string, col: number, row: number, mapId: string): MazeTileState {
  switch (ch) {
    case '#':
      return { col, row, kind: 'wall', hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY };
    case 'B':
      return { col, row, kind: 'soft_block', hp: 1, maxHp: 1 };
    case '?':
      return { col, row, kind: 'soft_block', hp: 1, maxHp: 1, guaranteedPowerUp: true };
    case 'K':
      return { col, row, kind: 'soft_block', hp: 1, maxHp: 1 };
    case 'H':
      return { col, row, kind: 'hard_block', hp: 2, maxHp: 2 };
    case ' ':
    case '.':
    case 'S':
    case 'P':
      return { col, row, kind: 'floor', hp: 0, maxHp: 0 };
    case 'X':
      return { col, row, kind: 'portal', hp: 0, maxHp: 0 };
    case '1':
      return { col, row, kind: 'warp_a', hp: 0, maxHp: 0 };
    case '2':
      return { col, row, kind: 'warp_b', hp: 0, maxHp: 0 };
    default:
      throw new Error(`Carácter desconocido '${ch}' en mapa "${mapId}" en (${col}, ${row})`);
  }
}

export function isTileSolidKind(kind: MazeTileKind): boolean {
  return kind === 'wall' || kind === 'soft_block' || kind === 'hard_block';
}

function directionDelta(direction: MoveDirection): { dx: number; dy: number } {
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'right':
      return { dx: 1, dy: 0 };
    case 'none':
      return { dx: 0, dy: 0 };
  }
}

function snapNearInteger(value: number): number {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= EPS ? rounded : value;
}

function advanceAlongAxis(
  pos: number,
  dirSign: 1 | -1,
  stepDist: number,
  isCoordOpen: (coord: number) => boolean
): number {
  const cleanPos = snapNearInteger(pos);
  if (dirSign > 0) {
    const base = Math.floor(cleanPos + EPS);
    const nextTile = base + 1;
    if (!isCoordOpen(nextTile)) {
      return cleanPos;
    }
    const target = cleanPos + stepDist;
    return isCoordOpen(nextTile + 1) ? target : Math.min(target, nextTile);
  }

  const base = Math.ceil(cleanPos - EPS);
  const nextTile = base - 1;
  if (!isCoordOpen(nextTile)) {
    return cleanPos;
  }
  const target = cleanPos - stepDist;
  return isCoordOpen(nextTile - 1) ? target : Math.max(target, nextTile);
}

/**
 * Motor lógico puro y determinista de laberinto 2.5D (Pac-Man + Bomberman).
 * No depende de Phaser ni del DOM.
 */
export class MazeEngine {
  readonly config: MazeMapConfig;
  private readonly tiles: MazeTileState[][];
  private readonly collectibles: MazeCollectible[];
  private readonly portalPoint: GridPoint | null;
  private readonly warpAPoint: GridPoint | null;
  private readonly warpBPoint: GridPoint | null;
  private readonly totalOrbs: number;
  private readonly totalSeals: number;

  private readonly bubbleFuseMs: number;
  private readonly waveDurationMs: number;
  private readonly cornerAssistTolerance: number;
  private readonly powerUpDropEveryNBlocks: number;

  private player: MazePlayerState;
  private activeBubbles: ActiveBubble[] = [];
  private activeWaves: ActiveWave[] = [];
  private collectedOrbs = 0;
  private collectedTokens: string[] = [];
  private portalOpen: boolean;
  private portalEntered = false;

  private nextBubbleSeq = 0;
  private nextWaveSeq = 0;
  private nextItemSeq = 0;
  private brokenRegularBlocks = 0;
  private powerUpCursor = 0;
  private warpCooldownTile: GridPoint | null = null;

  constructor(config: MazeMapConfig, options: MazeEngineOptions = {}) {
    this.config = config;
    const parsed = parseMazeMap(config, options.playerSpawn);

    this.tiles = parsed.tiles;
    this.collectibles = parsed.collectibles;
    this.portalPoint = parsed.portalPoint;
    this.warpAPoint = parsed.warpAPoint;
    this.warpBPoint = parsed.warpBPoint;
    this.totalOrbs = parsed.totalOrbs;
    this.totalSeals = parsed.totalSeals;

    this.bubbleFuseMs = Math.max(100, options.bubbleFuseMs ?? DEFAULT_BUBBLE_FUSE_MS);
    this.waveDurationMs = Math.max(50, options.waveDurationMs ?? DEFAULT_WAVE_DURATION_MS);
    this.cornerAssistTolerance = Math.max(
      0,
      Math.min(0.49, options.cornerAssistTolerance ?? DEFAULT_CORNER_ASSIST_TOLERANCE)
    );
    this.powerUpDropEveryNBlocks = Math.max(
      1,
      options.powerUpDropEveryNBlocks ?? DEFAULT_POWERUP_DROP_INTERVAL
    );

    this.portalOpen = this.totalSeals === 0;
    this.player = {
      x: parsed.playerSpawn.col,
      y: parsed.playerSpawn.row,
      tile: { ...parsed.playerSpawn },
      facing: 'down',
      speedTilesPerSec: Math.max(0.5, options.playerSpeedTilesPerSec ?? DEFAULT_PLAYER_SPEED_TILES_PER_SEC),
      speedMultiplier: 1,
      maxBubbles: Math.max(1, options.initialMaxBubbles ?? DEFAULT_INITIAL_MAX_BUBBLES),
      waveRange: Math.max(1, options.initialWaveRange ?? DEFAULT_INITIAL_WAVE_RANGE),
      score: 0,
    };
  }

  isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.config.cols && row >= 0 && row < this.config.rows;
  }

  getTile(col: number, row: number): MazeTileState | null {
    if (!this.isInBounds(col, row)) return null;
    const tile = this.tiles[row]?.[col];
    return tile ? { ...tile } : null;
  }

  isWalkableTile(col: number, row: number, ignorePassableBubbles = false): boolean {
    if (!this.isInBounds(col, row)) return false;
    const tile = this.tiles[row]?.[col];
    if (!tile || isTileSolidKind(tile.kind)) return false;

    const blockingBubble = this.activeBubbles.some(
      (bubble) =>
        bubble.col === col &&
        bubble.row === row &&
        (ignorePassableBubbles || !bubble.passableByPlayer)
    );
    return !blockingBubble;
  }

  getPlayerState(): MazePlayerState {
    return {
      ...this.player,
      tile: { ...this.player.tile },
    };
  }

  getCollectibles(): MazeCollectible[] {
    return this.collectibles.map((item) => ({ ...item }));
  }

  getActiveBubbles(): ActiveBubble[] {
    return this.activeBubbles.map((bubble) => ({ ...bubble }));
  }

  getActiveWaves(): ActiveWave[] {
    return this.activeWaves.map((wave) => ({
      ...wave,
      origin: { ...wave.origin },
      tiles: wave.tiles.map((pt) => ({ ...pt })),
    }));
  }

  getPortalState(): { point: GridPoint | null; open: boolean; entered: boolean } {
    return {
      point: this.portalPoint ? { ...this.portalPoint } : null,
      open: this.portalOpen,
      entered: this.portalEntered,
    };
  }

  getState(): MazeEngineSnapshot {
    return {
      mapId: this.config.id,
      biome: this.config.biome,
      cols: this.config.cols,
      rows: this.config.rows,
      player: this.getPlayerState(),
      tiles: this.tiles.map((row) => row.map((tile) => tile.kind)),
      collectibles: this.getCollectibles(),
      activeBubbles: this.getActiveBubbles(),
      activeWaves: this.getActiveWaves(),
      collectedOrbs: this.collectedOrbs,
      totalOrbs: this.totalOrbs,
      collectedSeals: this.collectedTokens.length,
      totalSeals: this.totalSeals,
      collectedTokens: [...this.collectedTokens],
      portalPoint: this.portalPoint ? { ...this.portalPoint } : null,
      portalOpen: this.portalOpen,
      portalEntered: this.portalEntered,
      score: this.player.score,
    };
  }

  /**
   * Coloca una burbuja sónica en la celda actual del explorador si hay capacidad disponible.
   */
  placeBubble(eventsOut?: MazeEvent[]): ActiveBubble | null {
    if (this.activeBubbles.length >= this.player.maxBubbles) {
      return null;
    }

    const col = Math.round(this.player.x);
    const row = Math.round(this.player.y);
    const tile = this.tiles[row]?.[col];
    if (!tile || isTileSolidKind(tile.kind)) {
      return null;
    }

    const occupied = this.activeBubbles.some((b) => b.col === col && b.row === row);
    if (occupied) {
      return null;
    }

    this.nextBubbleSeq += 1;
    const bubble: ActiveBubble = {
      id: `bubble-${this.nextBubbleSeq}`,
      col,
      row,
      fuseMs: this.bubbleFuseMs,
      remainingMs: this.bubbleFuseMs,
      range: this.player.waveRange,
      passableByPlayer: true,
    };
    this.activeBubbles.push(bubble);
    eventsOut?.push({ type: 'bubble_placed', bubble: { ...bubble } });
    return { ...bubble };
  }

  /**
   * Aplica efecto inmediato de un power-up sobre las estadísticas del laberinto.
   */
  applyPowerUp(kind: PowerUpKind): void {
    switch (kind) {
      case 'extra_bubble':
        this.player.maxBubbles = Math.min(MAX_BUBBLES_CAP, this.player.maxBubbles + 1);
        break;
      case 'long_wave':
        this.player.waveRange = Math.min(MAX_WAVE_RANGE_CAP, this.player.waveRange + 1);
        break;
      case 'turbo_boots':
        this.player.speedMultiplier = TURBO_SPEED_MULTIPLIER;
        break;
      case 'solar_shield':
      case 'golden_orb':
        break;
    }
  }

  /**
   * Avanza la simulación determinista durante `dtSec` segundos usando subpasos fijos.
   */
  step(dtSec: number, input: MazeStepInput = {}): MazeStepResult {
    const events: MazeEvent[] = [];

    if (input.placeBubble) {
      this.placeBubble(events);
    }

    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      return { events, snapshot: this.getState() };
    }

    const direction = input.direction ?? 'none';
    const effectiveSpeed = this.player.speedTilesPerSec * this.player.speedMultiplier;
    const maxSliceByDist = 0.1 / Math.max(0.5, effectiveSpeed);
    let remainingSec = dtSec;

    while (remainingSec > EPS) {
      const sliceSec = Math.min(remainingSec, MAX_SUBSTEP_SEC, maxSliceByDist);
      remainingSec -= sliceSec;
      this.stepSlice(sliceSec, direction, events);
    }

    return {
      events,
      snapshot: this.getState(),
    };
  }

  private stepSlice(dtSec: number, direction: MoveDirection, events: MazeEvent[]): void {
    const dtMs = dtSec * 1000;

    if (direction !== 'none') {
      this.player.facing = direction;
      const dist = this.player.speedTilesPerSec * this.player.speedMultiplier * dtSec;
      this.movePlayer(direction, dist);
      this.updateBubblePassability();
      this.handleTileInteractions(events);
    }

    this.advanceActiveWaves(dtMs);
    this.advanceActiveBubbles(dtMs, events);
  }

  private movePlayer(direction: MoveDirection, dist: number): void {
    if (direction === 'none' || dist <= 0) return;

    const { dx, dy } = directionDelta(direction);
    const isHorizontal = dx !== 0;
    const dirSign = (isHorizontal ? dx : dy) as 1 | -1;

    const primaryPos = isHorizontal ? this.player.x : this.player.y;
    const crossPos = isHorizontal ? this.player.y : this.player.x;
    const primaryTile = Math.round(primaryPos);
    const nearestCrossTile = Math.round(crossPos);

    const checkAxisOpen = (axisCoord: number, fixedCross: number): boolean =>
      isHorizontal
        ? this.isWalkableTile(axisCoord, fixedCross)
        : this.isWalkableTile(fixedCross, axisCoord);

    const crossOffset = nearestCrossTile - crossPos;
    let nextCross = crossPos;
    let remainingDist = dist;

    if (Math.abs(crossOffset) > EPS) {
      const withinAssist = Math.abs(crossOffset) <= this.cornerAssistTolerance + EPS;
      const laneOpen =
        withinAssist &&
        checkAxisOpen(primaryTile, nearestCrossTile) &&
        advanceAlongAxis(primaryPos, dirSign, 0.05, (c) => checkAxisOpen(c, nearestCrossTile)) !==
          snapNearInteger(primaryPos);

      if (!laneOpen) {
        return;
      }

      const alignMove = Math.min(Math.abs(crossOffset), remainingDist);
      nextCross =
        Math.abs(crossOffset) - alignMove <= EPS
          ? nearestCrossTile
          : crossPos + Math.sign(crossOffset) * alignMove;
      remainingDist -= alignMove;
    } else {
      nextCross = nearestCrossTile;
    }

    let nextPrimary = primaryPos;
    if (remainingDist > EPS && Math.abs(nextCross - nearestCrossTile) <= EPS) {
      nextPrimary = advanceAlongAxis(primaryPos, dirSign, remainingDist, (c) =>
        checkAxisOpen(c, nearestCrossTile)
      );
    }

    if (isHorizontal) {
      this.player.x = nextPrimary;
      this.player.y = nextCross;
    } else {
      this.player.x = nextCross;
      this.player.y = nextPrimary;
    }

    this.player.tile = {
      col: Math.round(this.player.x),
      row: Math.round(this.player.y),
    };
  }

  private updateBubblePassability(): void {
    for (const bubble of this.activeBubbles) {
      if (!bubble.passableByPlayer) continue;
      const dx = Math.abs(this.player.x - bubble.col);
      const dy = Math.abs(this.player.y - bubble.row);
      if (dx >= BUBBLE_EXIT_THRESHOLD || dy >= BUBBLE_EXIT_THRESHOLD) {
        bubble.passableByPlayer = false;
      }
    }
  }

  private handleTileInteractions(events: MazeEvent[]): void {
    const col = this.player.tile.col;
    const row = this.player.tile.row;

    if (
      this.warpCooldownTile &&
      (this.warpCooldownTile.col !== col || this.warpCooldownTile.row !== row)
    ) {
      this.warpCooldownTile = null;
    }

    this.collectAtPlayerTile(col, row, events);
    if (this.checkWarpAtTile(col, row, events)) {
      this.collectAtPlayerTile(this.player.tile.col, this.player.tile.row, events);
    }
    this.checkPortalAtTile(this.player.tile.col, this.player.tile.row, events);
  }

  private collectAtPlayerTile(col: number, row: number, events: MazeEvent[]): void {
    for (let i = this.collectibles.length - 1; i >= 0; i -= 1) {
      const item = this.collectibles[i];
      if (!item || item.col !== col || item.row !== row) continue;

      this.collectibles.splice(i, 1);

      if (item.kind === 'star_orb') {
        this.collectedOrbs += 1;
        this.player.score += SCORE_STAR_ORB;
        events.push({
          type: 'orb_collected',
          point: { col, row },
          scoreGained: SCORE_STAR_ORB,
        });
      } else if (item.kind === 'syllable_seal') {
        const token = item.token ?? '';
        this.collectedTokens.push(token);
        this.player.score += SCORE_SYLLABLE_SEAL;
        events.push({
          type: 'seal_collected',
          point: { col, row },
          token,
          collectedSeals: this.collectedTokens.length,
          totalSeals: this.totalSeals,
          scoreGained: SCORE_SYLLABLE_SEAL,
        });

        if (!this.portalOpen && this.collectedTokens.length >= this.totalSeals) {
          this.portalOpen = true;
          events.push({
            type: 'portal_opened',
            point: this.portalPoint ? { ...this.portalPoint } : null,
          });
        }
      } else if (item.kind === 'power_up' && item.powerUpKind) {
        this.player.score += SCORE_POWER_UP;
        this.applyPowerUp(item.powerUpKind);
        events.push({
          type: 'powerup_collected',
          point: { col, row },
          kind: item.powerUpKind,
          scoreGained: SCORE_POWER_UP,
        });
      }
    }
  }

  private checkWarpAtTile(col: number, row: number, events: MazeEvent[]): boolean {
    if (this.warpCooldownTile) return false;
    const tile = this.tiles[row]?.[col];
    if (!tile) return false;

    let destination: GridPoint | null = null;
    if (tile.kind === 'warp_a' && this.warpBPoint) {
      destination = this.warpBPoint;
    } else if (tile.kind === 'warp_b' && this.warpAPoint) {
      destination = this.warpAPoint;
    }

    if (!destination) return false;
    if (Math.abs(this.player.x - col) > 0.25 || Math.abs(this.player.y - row) > 0.25) {
      return false;
    }

    const from = { col, row };
    this.player.x = destination.col;
    this.player.y = destination.row;
    this.player.tile = { ...destination };
    this.warpCooldownTile = { ...destination };
    events.push({ type: 'warped', from, to: { ...destination } });
    return true;
  }

  private checkPortalAtTile(col: number, row: number, events: MazeEvent[]): void {
    if (!this.portalOpen || this.portalEntered || !this.portalPoint) return;
    if (col === this.portalPoint.col && row === this.portalPoint.row) {
      this.portalEntered = true;
      events.push({ type: 'portal_entered', point: { ...this.portalPoint } });
    }
  }

  private advanceActiveWaves(dtMs: number): void {
    for (let i = this.activeWaves.length - 1; i >= 0; i -= 1) {
      const wave = this.activeWaves[i];
      if (!wave) continue;
      wave.remainingMs -= dtMs;
      if (wave.remainingMs <= 0) {
        this.activeWaves.splice(i, 1);
      }
    }
  }

  private advanceActiveBubbles(dtMs: number, events: MazeEvent[]): void {
    const expiredIds: string[] = [];
    for (const bubble of this.activeBubbles) {
      bubble.remainingMs -= dtMs;
      if (bubble.remainingMs <= 0) {
        expiredIds.push(bubble.id);
      }
    }

    if (expiredIds.length === 0) return;

    const visited = new Set<string>();
    for (const id of expiredIds) {
      this.detonateBubbleInternal(id, visited, events);
    }
  }

  /**
   * Detona explícitamente una burbuja activa y propaga reacciones en cadena.
   */
  detonateBubble(bubbleId: string): { wave: ActiveWave; events: MazeEvent[] } | null {
    const events: MazeEvent[] = [];
    const wave = this.detonateBubbleInternal(bubbleId, new Set<string>(), events);
    if (!wave) return null;
    return { wave, events };
  }

  private detonateBubbleInternal(
    bubbleId: string,
    visited: Set<string>,
    events: MazeEvent[]
  ): ActiveWave | null {
    if (visited.has(bubbleId)) return null;
    const index = this.activeBubbles.findIndex((b) => b.id === bubbleId);
    if (index === -1) return null;

    const bubble = this.activeBubbles[index];
    if (!bubble) return null;

    visited.add(bubbleId);
    this.activeBubbles.splice(index, 1);

    const waveTiles: GridPoint[] = [{ col: bubble.col, row: bubble.row }];
    const brokenBlocks: GridPoint[] = [];
    const chainBubbleIds: string[] = [];

    for (const { dc, dr } of CARDINAL_OFFSETS) {
      for (let step = 1; step <= bubble.range; step += 1) {
        const tc = bubble.col + dc * step;
        const tr = bubble.row + dr * step;
        const tile = this.tiles[tr]?.[tc];
        if (!tile) break;

        if (tile.kind === 'wall') {
          break;
        }

        waveTiles.push({ col: tc, row: tr });

        if (tile.kind === 'soft_block' || tile.kind === 'hard_block') {
          const destroyed = this.damageBreakableTile(tile, events);
          if (destroyed) {
            brokenBlocks.push({ col: tc, row: tr });
          }
          break;
        }

        const hitBubble = this.activeBubbles.find(
          (other) => other.col === tc && other.row === tr && !visited.has(other.id)
        );
        if (hitBubble) {
          chainBubbleIds.push(hitBubble.id);
        }
      }
    }

    this.nextWaveSeq += 1;
    const wave: ActiveWave = {
      id: `wave-${this.nextWaveSeq}`,
      origin: { col: bubble.col, row: bubble.row },
      tiles: waveTiles,
      remainingMs: this.waveDurationMs,
    };
    this.activeWaves.push(wave);
    events.push({
      type: 'wave_triggered',
      wave: {
        ...wave,
        origin: { ...wave.origin },
        tiles: wave.tiles.map((pt) => ({ ...pt })),
      },
      brokenBlocks: brokenBlocks.map((pt) => ({ ...pt })),
    });

    for (const chainId of chainBubbleIds) {
      this.detonateBubbleInternal(chainId, visited, events);
    }

    return wave;
  }

  private damageBreakableTile(tile: MazeTileState, events: MazeEvent[]): boolean {
    tile.hp = Math.max(0, tile.hp - 1);
    const destroyed = tile.hp === 0;
    const point: GridPoint = { col: tile.col, row: tile.row };

    events.push({
      type: 'block_damaged',
      point,
      remainingHp: tile.hp,
      destroyed,
    });

    if (!destroyed) return false;

    tile.kind = 'floor';
    this.player.score += SCORE_BLOCK_BROKEN;
    this.revealBlockLoot(tile, events);
    return true;
  }

  private revealBlockLoot(tile: MazeTileState, events: MazeEvent[]): void {
    const point: GridPoint = { col: tile.col, row: tile.row };

    if (tile.hiddenSealToken !== undefined) {
      this.nextItemSeq += 1;
      const seal: MazeCollectible = {
        id: `reveal-seal-${this.nextItemSeq}`,
        kind: 'syllable_seal',
        col: tile.col,
        row: tile.row,
        token: tile.hiddenSealToken,
      };
      tile.hiddenSealToken = undefined;
      this.collectibles.push(seal);
      events.push({ type: 'item_revealed', point, collectible: { ...seal } });
      return;
    }

    const pool = this.config.powerUpPool;
    if (pool.length === 0) return;

    let shouldDrop = false;
    if (tile.guaranteedPowerUp) {
      tile.guaranteedPowerUp = false;
      shouldDrop = true;
    } else {
      this.brokenRegularBlocks += 1;
      shouldDrop = this.brokenRegularBlocks % this.powerUpDropEveryNBlocks === 0;
    }

    if (!shouldDrop) return;

    const kind = pool[this.powerUpCursor % pool.length];
    if (!kind) return;
    this.powerUpCursor += 1;
    this.nextItemSeq += 1;

    const powerUp: MazeCollectible = {
      id: `reveal-powerup-${this.nextItemSeq}`,
      kind: 'power_up',
      col: tile.col,
      row: tile.row,
      powerUpKind: kind,
    };
    this.collectibles.push(powerUp);
    events.push({ type: 'item_revealed', point, collectible: { ...powerUp } });
  }
}
