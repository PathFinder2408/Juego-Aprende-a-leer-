import bossesData from '../../data/bosses.json';
import type {
  BossAbilityKind,
  BossConfig,
  GridPoint,
  MoveDirection,
} from '../../types/campaign';
import {
  findNextDirectionBfs,
  isEnemyWalkableTile,
  type EnemyGridContext,
} from './enemyAI';

export const BOSS_STUN_DURATION_MS = 2600;
export const BOSS_CONTACT_RADIUS = 0.68;
export const SCORE_BOSS_HIT = 100;
export const SCORE_BOSS_DEFEAT = 250;

const EPS = 1e-5;
const MAX_SUBSTEP_SEC = 1 / 60;

type CardinalDirection = Exclude<MoveDirection, 'none'>;

const CARDINAL_OFFSETS: ReadonlyArray<{ dir: CardinalDirection; dc: number; dr: number }> = [
  { dir: 'up', dc: 0, dr: -1 },
  { dir: 'right', dc: 1, dr: 0 },
  { dir: 'down', dc: 0, dr: 1 },
  { dir: 'left', dc: -1, dr: 0 },
];

export interface BossAbilityProfile {
  cooldownMs: number;
  muteBlockCount: number;
  speedBoostMultiplier: number;
  boostDurationMs: number;
  speechCue: string;
}

export const BOSS_ABILITY_PROFILES: Record<BossAbilityKind, BossAbilityProfile> = {
  silence_blocks: {
    cooldownMs: 5200,
    muteBlockCount: 1,
    speedBoostMultiplier: 1.15,
    boostDurationMs: 1000,
    speechCue: '¡Bloque mudo!',
  },
  mist_dash: {
    cooldownMs: 4800,
    muteBlockCount: 0,
    speedBoostMultiplier: 1.75,
    boostDurationMs: 1400,
    speechCue: '¡Ráfaga de niebla!',
  },
  word_scramble: {
    cooldownMs: 5000,
    muteBlockCount: 1,
    speedBoostMultiplier: 1.45,
    boostDurationMs: 1400,
    speechCue: '¡Eco travieso!',
  },
  ink_trap: {
    cooldownMs: 5400,
    muteBlockCount: 2,
    speedBoostMultiplier: 1.35,
    boostDurationMs: 1200,
    speechCue: '¡Trampa de tinta!',
  },
};

export type BossStateKind = 'patrol' | 'dashing' | 'stunned' | 'defeated';

export interface BossRuntimeState {
  id: string;
  name: string;
  chapterId: string;
  ability: BossAbilityKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  tile: GridPoint;
  facing: MoveDirection;
  speedTilesPerSec: number;
  state: BossStateKind;
  stunRemainingMs: number;
  boostRemainingMs: number;
  abilityCooldownMs: number;
  decisionCounter: number;
}

export type BossEvent =
  | { type: 'boss_hit'; bossId: string; remainingHp: number; maxHp: number; point: GridPoint; scoreGained: number }
  | { type: 'boss_defeated'; bossId: string; name: string; point: GridPoint; scoreGained: number }
  | { type: 'boss_ability_used'; bossId: string; ability: BossAbilityKind; speechCue: string; candidateBlocks: GridPoint[] }
  | { type: 'player_touched_boss'; bossId: string; point: GridPoint };

const BOSS_LIST = bossesData as BossConfig[];

export function getAllBosses(): BossConfig[] {
  return BOSS_LIST;
}

export function getBossById(bossId: string): BossConfig | undefined {
  return BOSS_LIST.find((b) => b.id === bossId);
}

/**
 * Inicializa el estado determinista de un jefe desde su configuración JSON.
 */
export function createBossState(config: BossConfig, spawn: GridPoint): BossRuntimeState {
  const profile = BOSS_ABILITY_PROFILES[config.ability];
  return {
    id: config.id,
    name: config.name,
    chapterId: config.chapterId,
    ability: config.ability,
    hp: Math.max(1, config.hp),
    maxHp: Math.max(1, config.hp),
    x: spawn.col,
    y: spawn.row,
    tile: { ...spawn },
    facing: 'left',
    speedTilesPerSec: Math.max(0.5, config.speedTilesPerSec),
    state: 'patrol',
    stunRemainingMs: 0,
    boostRemainingMs: 0,
    abilityCooldownMs: profile.cooldownMs,
    decisionCounter: 0,
  };
}

function isTileInActiveWaves(tile: GridPoint, ctx: EnemyGridContext): boolean {
  for (const wave of ctx.activeWaves) {
    for (const pt of wave.tiles) {
      if (pt.col === tile.col && pt.row === tile.row) return true;
    }
  }
  return false;
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

function chooseBossDirection(boss: BossRuntimeState, ctx: EnemyGridContext): MoveDirection {
  const bfsDir = findNextDirectionBfs(ctx, boss.tile, ctx.playerTile, boss.facing);
  if (boss.state === 'dashing' && bfsDir) {
    return bfsDir;
  }

  // Alterna entre persecución inteligente y patrulla predecible para dar respiro al niño
  const openDirs: CardinalDirection[] = [];
  for (const item of CARDINAL_OFFSETS) {
    if (isEnemyWalkableTile(ctx, boss.tile.col + item.dc, boss.tile.row + item.dr)) {
      openDirs.push(item.dir);
    }
  }
  if (openDirs.length === 0) return 'none';

  boss.decisionCounter += 1;
  if (bfsDir && boss.decisionCounter % 2 === 0) {
    return bfsDir;
  }
  if (openDirs.includes(boss.facing as CardinalDirection) && openDirs.length <= 2) {
    return boss.facing;
  }
  return openDirs[boss.decisionCounter % openDirs.length] ?? openDirs[0] ?? 'left';
}

function collectCandidateMuteBlocks(
  boss: BossRuntimeState,
  ctx: EnemyGridContext,
  count: number
): GridPoint[] {
  if (count <= 0) return [];
  const candidates: GridPoint[] = [];

  for (let i = 0; i < CARDINAL_OFFSETS.length && candidates.length < count; i += 1) {
    const offset = CARDINAL_OFFSETS[(i + boss.decisionCounter) % CARDINAL_OFFSETS.length];
    if (!offset) continue;
    const nc = boss.tile.col + offset.dc;
    const nr = boss.tile.row + offset.dr;
    if (nc === ctx.playerTile.col && nr === ctx.playerTile.row) continue;
    if (!isEnemyWalkableTile(ctx, nc, nr)) continue;

    const tileKind = ctx.tiles[nr]?.[nc];
    if (tileKind === 'floor') {
      candidates.push({ col: nc, row: nr });
    }
  }

  return candidates;
}

function stepBossSlice(
  boss: BossRuntimeState,
  ctx: EnemyGridContext,
  dtSec: number,
  events: BossEvent[]
): void {
  if (boss.state === 'defeated') return;

  const dtMs = dtSec * 1000;

  if (boss.state !== 'stunned' && isTileInActiveWaves(boss.tile, ctx)) {
    boss.hp = Math.max(0, boss.hp - 1);
    boss.boostRemainingMs = 0;

    events.push({
      type: 'boss_hit',
      bossId: boss.id,
      remainingHp: boss.hp,
      maxHp: boss.maxHp,
      point: { ...boss.tile },
      scoreGained: SCORE_BOSS_HIT,
    });

    if (boss.hp === 0) {
      boss.state = 'defeated';
      events.push({
        type: 'boss_defeated',
        bossId: boss.id,
        name: boss.name,
        point: { ...boss.tile },
        scoreGained: SCORE_BOSS_DEFEAT,
      });
      return;
    }

    boss.state = 'stunned';
    boss.stunRemainingMs = BOSS_STUN_DURATION_MS;
    return;
  }

  if (boss.state === 'stunned') {
    boss.stunRemainingMs = Math.max(0, boss.stunRemainingMs - dtMs);
    if (boss.stunRemainingMs <= 0) {
      boss.state = 'patrol';
    }
    return;
  }

  const profile = BOSS_ABILITY_PROFILES[boss.ability];
  if (boss.boostRemainingMs > 0) {
    boss.boostRemainingMs = Math.max(0, boss.boostRemainingMs - dtMs);
    if (boss.boostRemainingMs <= 0 && boss.state === 'dashing') {
      boss.state = 'patrol';
    }
  }

  boss.abilityCooldownMs -= dtMs;
  if (boss.abilityCooldownMs <= 0) {
    boss.abilityCooldownMs = profile.cooldownMs;
    boss.boostRemainingMs = profile.boostDurationMs;
    boss.state = 'dashing';
    const candidateBlocks = collectCandidateMuteBlocks(boss, ctx, profile.muteBlockCount);
    events.push({
      type: 'boss_ability_used',
      bossId: boss.id,
      ability: boss.ability,
      speechCue: profile.speechCue,
      candidateBlocks,
    });
  }

  const speedMult = boss.state === 'dashing' ? profile.speedBoostMultiplier : 1;
  let remainingDist = boss.speedTilesPerSec * speedMult * dtSec;
  let guard = 0;

  while (remainingDist > EPS && guard < 4) {
    guard += 1;
    const atColCenter = Math.abs(boss.x - Math.round(boss.x)) <= EPS;
    const atRowCenter = Math.abs(boss.y - Math.round(boss.y)) <= EPS;

    if (atColCenter && atRowCenter) {
      boss.x = Math.round(boss.x);
      boss.y = Math.round(boss.y);
      boss.tile = { col: boss.x, row: boss.y };
      boss.facing = chooseBossDirection(boss, ctx);
    }

    if (boss.facing === 'none') break;

    const { dc, dr } = directionOffset(boss.facing);
    const nextCol =
      dc > 0
        ? Math.floor(boss.x + EPS) + 1
        : dc < 0
          ? Math.ceil(boss.x - EPS) - 1
          : Math.round(boss.x);
    const nextRow =
      dr > 0
        ? Math.floor(boss.y + EPS) + 1
        : dr < 0
          ? Math.ceil(boss.y - EPS) - 1
          : Math.round(boss.y);

    if (!isEnemyWalkableTile(ctx, nextCol, nextRow)) {
      boss.facing = 'none';
      break;
    }

    const distToCenter = Math.abs(nextCol - boss.x) + Math.abs(nextRow - boss.y);
    const step = Math.min(remainingDist, distToCenter);
    boss.x += dc * step;
    boss.y += dr * step;
    remainingDist -= step;

    if (Math.abs(boss.x - nextCol) <= EPS && Math.abs(boss.y - nextRow) <= EPS) {
      boss.x = nextCol;
      boss.y = nextRow;
    }
    boss.tile = { col: Math.round(boss.x), row: Math.round(boss.y) };
  }
}

/**
 * Avanza la máquina de estados del jefe y evalúa contacto con el jugador.
 */
export function stepBoss(
  boss: BossRuntimeState,
  ctx: EnemyGridContext,
  dtSec: number
): BossEvent[] {
  const events: BossEvent[] = [];
  if (!Number.isFinite(dtSec) || dtSec <= 0 || boss.state === 'defeated') {
    return events;
  }

  let remainingSec = dtSec;
  while (remainingSec > EPS) {
    const sliceSec = Math.min(remainingSec, MAX_SUBSTEP_SEC);
    remainingSec -= sliceSec;
    stepBossSlice(boss, ctx, sliceSec, events);
  }

  if (boss.state === 'patrol' || boss.state === 'dashing') {
    const dist = Math.hypot(boss.x - ctx.playerX, boss.y - ctx.playerY);
    if (dist <= BOSS_CONTACT_RADIUS) {
      events.push({
        type: 'player_touched_boss',
        bossId: boss.id,
        point: { ...boss.tile },
      });
    }
  }

  return events;
}
