import Phaser from 'phaser';
import type { BiomeId, EnemyKind, GridPoint, MazeTileKind, PowerUpKind } from '../../types/campaign';
import type { BossRuntimeState } from './bossBehavior';
import type { EnemyRuntimeState } from './enemyAI';
import type {
  ActiveBubble,
  ActiveWave,
  MazeCollectible,
  MazeEngineSnapshot,
} from './mazeEngine';

export const MAZE_TILE_SIZE = 56;

interface BiomePalette {
  floorLight: string;
  floorDark: string;
  wallTop: string;
  wallFront: string;
  wallStroke: string;
  softTop: string;
  softFront: string;
  hardTop: string;
  hardFront: string;
  accent: string;
}

const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  beach: {
    floorLight: '#fef3c7',
    floorDark: '#fde68a',
    wallTop: '#38bdf8',
    wallFront: '#0284c7',
    wallStroke: '#0c4a6e',
    softTop: '#fbbf24',
    softFront: '#d97706',
    hardTop: '#94a3b8',
    hardFront: '#475569',
    accent: '#0ea5e9',
  },
  jungle: {
    floorLight: '#dcfce7',
    floorDark: '#bbf7d0',
    wallTop: '#22c55e',
    wallFront: '#15803d',
    wallStroke: '#14532d',
    softTop: '#a16207',
    softFront: '#713f12',
    hardTop: '#64748b',
    hardFront: '#334155',
    accent: '#10b981',
  },
  canyon: {
    floorLight: '#ffedd5',
    floorDark: '#fed7aa',
    wallTop: '#f97316',
    wallFront: '#c2410c',
    wallStroke: '#7c2d12',
    softTop: '#f59e0b',
    softFront: '#b45309',
    hardTop: '#78716c',
    hardFront: '#44403c',
    accent: '#ea580c',
  },
  volcano: {
    floorLight: '#fee2e2',
    floorDark: '#fecaca',
    wallTop: '#ef4444',
    wallFront: '#b91c1c',
    wallStroke: '#7f1d1d',
    softTop: '#fb923c',
    softFront: '#c2410c',
    hardTop: '#52525b',
    hardFront: '#27272a',
    accent: '#dc2626',
  },
  ruins: {
    floorLight: '#ede9fe',
    floorDark: '#ddd6fe',
    wallTop: '#8b5cf6',
    wallFront: '#6d28d9',
    wallStroke: '#4c1d95',
    softTop: '#c084fc',
    softFront: '#9333ea',
    hardTop: '#64748b',
    hardFront: '#334155',
    accent: '#7c3aed',
  },
  star_dome: {
    floorLight: '#e0f2fe',
    floorDark: '#bae6fd',
    wallTop: '#0ea5e9',
    wallFront: '#0369a1',
    wallStroke: '#082f49',
    softTop: '#38bdf8',
    softFront: '#0284c7',
    hardTop: '#475569',
    hardFront: '#1e293b',
    accent: '#6366f1',
  },
};

const POWERUP_BADGE_MAP: Record<PowerUpKind, { label: string; color: string }> = {
  extra_bubble: { label: '+B', color: '#38bdf8' },
  long_wave: { label: '+O', color: '#f97316' },
  turbo_boots: { label: '⚡', color: '#facc15' },
  solar_shield: { label: '🛡', color: '#4ade80' },
  golden_orb: { label: '★', color: '#eab308' },
};

const ENEMY_STYLE_MAP: Record<EnemyKind, { bodyColor: number; emoji: string }> = {
  sleepy_shadow: { bodyColor: 0x6366f1, emoji: '😴' },
  mischief_crab: { bodyColor: 0xf97316, emoji: '🦀' },
  mute_echo: { bodyColor: 0xa855f7, emoji: '👻' },
  ash_spark: { bodyColor: 0xef4444, emoji: '🔥' },
  ink_sentry: { bodyColor: 0x1e293b, emoji: '🐙' },
};

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Renderizador 2.5D de grilla, bloques rompibles, orbes, sílabas, burbujas y portal.
 */
export class MazeRenderer {
  private readonly scene: Phaser.Scene;
  private readonly biome: BiomeId;
  private readonly highContrast: boolean;
  private readonly blockSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly collectibleNodes = new Map<string, Phaser.GameObjects.Container>();
  private readonly bubbleNodes = new Map<string, Phaser.GameObjects.Container>();
  private readonly waveNodes = new Map<string, Phaser.GameObjects.Container>();
  private readonly enemyNodes = new Map<
    string,
    {
      container: Phaser.GameObjects.Container;
      body: Phaser.GameObjects.Arc;
      statusTag: Phaser.GameObjects.Text;
    }
  >();
  private bossNode: {
    container: Phaser.GameObjects.Container;
    body: Phaser.GameObjects.Arc;
    hpTag: Phaser.GameObjects.Text;
    statusTag: Phaser.GameObjects.Text;
  } | null = null;
  private portalVisual: {
    ring: Phaser.GameObjects.Arc;
    core: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  } | null = null;
  private lastPortalOpen = false;

  constructor(scene: Phaser.Scene, snapshot: MazeEngineSnapshot, highContrast = false) {
    this.scene = scene;
    this.biome = snapshot.biome;
    this.highContrast = highContrast;
    this.ensureTextures();
    this.buildStaticFloorAndBlocks(snapshot);
    this.syncCollectibles(snapshot.collectibles, 0, true);
    this.updatePortalState(snapshot.portalOpen);
  }

  private texKey(name: string): string {
    return `maze-${this.biome}-${this.highContrast ? 'hc' : 'std'}-${name}`;
  }

  private ensureTextures(): void {
    const base = BIOME_PALETTES[this.biome];
    const palette: BiomePalette = this.highContrast
      ? {
          ...base,
          floorLight: '#f8fafc',
          floorDark: '#e2e8f0',
          wallStroke: '#020617',
        }
      : base;

    this.createBlockTexture(this.texKey('wall'), palette.wallTop, palette.wallFront, palette.wallStroke, 'wall');
    this.createBlockTexture(this.texKey('soft'), palette.softTop, palette.softFront, '#78350f', 'soft');
    this.createBlockTexture(this.texKey('hard'), palette.hardTop, palette.hardFront, '#1e293b', 'hard');
    this.createBlockTexture(this.texKey('hard-cracked'), palette.hardTop, palette.hardFront, '#1e293b', 'cracked');

    const orbKey = 'maze-star-orb';
    if (!this.scene.textures.exists(orbKey)) {
      const tex = this.scene.textures.createCanvas(orbKey, 28, 28);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(11, 10, 2, 14, 14, 12);
        grad.addColorStop(0, '#fef9c3');
        grad.addColorStop(0.55, '#facc15');
        grad.addColorStop(1, '#ca8a04');
        ctx.beginPath();
        ctx.arc(14, 14, 10, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#854d0e';
        ctx.stroke();
        tex.refresh();
      }
    }
  }

  private createBlockTexture(
    key: string,
    topColor: string,
    frontColor: string,
    strokeColor: string,
    variant: 'wall' | 'soft' | 'hard' | 'cracked'
  ): void {
    if (this.scene.textures.exists(key)) return;
    const size = MAZE_TILE_SIZE;
    const height = size + 12; // 12px extra arriba para volumen 2.5D
    const tex = this.scene.textures.createCanvas(key, size, height);
    if (!tex) return;

    const ctx = tex.getContext();
    // Cara frontal 2.5D
    drawRoundedRect(ctx, 2, 14, size - 4, size - 4, 8);
    ctx.fillStyle = frontColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    // Cara superior
    drawRoundedRect(ctx, 2, 2, size - 4, size - 14, 8);
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.stroke();

    // Brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    drawRoundedRect(ctx, 7, 5, size - 14, 8, 4);
    ctx.fill();

    if (variant === 'soft') {
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 14);
      ctx.lineTo(size - 10, size - 18);
      ctx.moveTo(size - 10, 14);
      ctx.lineTo(10, size - 18);
      ctx.stroke();
    } else if (variant === 'hard' || variant === 'cracked') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(12, 12, 3, 0, Math.PI * 2);
      ctx.arc(size - 12, 12, 3, 0, Math.PI * 2);
      ctx.fill();

      if (variant === 'cracked') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(16, 10);
        ctx.lineTo(28, 22);
        ctx.lineTo(22, 30);
        ctx.lineTo(36, 38);
        ctx.stroke();
      }
    }

    tex.refresh();
  }

  private buildStaticFloorAndBlocks(snapshot: MazeEngineSnapshot): void {
    const base = BIOME_PALETTES[this.biome];
    const floorLight = Phaser.Display.Color.HexStringToColor(
      this.highContrast ? '#f8fafc' : base.floorLight
    ).color;
    const floorDark = Phaser.Display.Color.HexStringToColor(
      this.highContrast ? '#e2e8f0' : base.floorDark
    ).color;

    for (let row = 0; row < snapshot.rows; row += 1) {
      for (let col = 0; col < snapshot.cols; col += 1) {
        const cx = (col + 0.5) * MAZE_TILE_SIZE;
        const cy = (row + 0.5) * MAZE_TILE_SIZE;
        const tileKind = snapshot.tiles[row]?.[col] ?? 'floor';

        const floorColor = (col + row) % 2 === 0 ? floorLight : floorDark;
        this.scene.add
          .rectangle(cx, cy, MAZE_TILE_SIZE, MAZE_TILE_SIZE, floorColor)
          .setDepth(1);

        if (tileKind === 'warp_a' || tileKind === 'warp_b') {
          this.renderWarpPad(cx, cy, tileKind);
        } else if (tileKind === 'portal') {
          this.renderPortalPad(cx, cy, snapshot.portalOpen);
        } else if (tileKind === 'wall' || tileKind === 'soft_block' || tileKind === 'hard_block') {
          this.createTileBlockSprite(col, row, tileKind, false);
        }
      }
    }
  }

  private renderWarpPad(cx: number, cy: number, kind: 'warp_a' | 'warp_b'): void {
    const color = kind === 'warp_a' ? 0x38bdf8 : 0xa855f7;
    this.scene.add.circle(cx, cy, 20, color, 0.25).setDepth(2);
    this.scene.add.circle(cx, cy, 13, color, 0.72).setStrokeStyle(2.5, 0xffffff).setDepth(3);
    this.scene.add
      .text(cx, cy, '⇄', {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private renderPortalPad(cx: number, cy: number, open: boolean): void {
    const ring = this.scene.add
      .circle(cx, cy, 24, open ? 0x22c55e : 0x64748b, 0.25)
      .setStrokeStyle(3, open ? 0x4ade80 : 0x94a3b8)
      .setDepth(3);
    const core = this.scene.add
      .circle(cx, cy, 15, open ? 0x16a34a : 0x475569, 0.9)
      .setDepth(4);
    const label = this.scene.add
      .text(cx, cy, open ? '★' : '🔒', {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.portalVisual = { ring, core, label };
    this.lastPortalOpen = open;
  }

  private createTileBlockSprite(
    col: number,
    row: number,
    kind: MazeTileKind,
    cracked: boolean
  ): void {
    const cx = (col + 0.5) * MAZE_TILE_SIZE;
    const cy = (row + 0.5) * MAZE_TILE_SIZE;
    const key =
      kind === 'wall'
        ? this.texKey('wall')
        : kind === 'soft_block'
          ? this.texKey('soft')
          : cracked
            ? this.texKey('hard-cracked')
            : this.texKey('hard');

    const img = this.scene.add.image(cx, cy - 6, key).setDepth(cy);
    this.blockSprites.set(tileKey(col, row), img);
  }

  /**
   * Crea dinámicamente un bloque blando temporal (obstáculo mudo de jefe).
   */
  spawnMuteBlock(point: GridPoint): void {
    const key = tileKey(point.col, point.row);
    if (this.blockSprites.has(key)) return;
    this.createTileBlockSprite(point.col, point.row, 'soft_block', false);
  }

  /**
   * Actualiza un bloque dañado o destruido tras onda de burbuja.
   */
  updateBlockTile(point: GridPoint, remainingHp: number, destroyed: boolean): void {
    const key = tileKey(point.col, point.row);
    const existing = this.blockSprites.get(key);
    if (!existing) return;

    if (destroyed) {
      existing.destroy();
      this.blockSprites.delete(key);
      return;
    }

    if (remainingHp === 1) {
      existing.setTexture(this.texKey('hard-cracked'));
    }
  }

  updatePortalState(open: boolean): void {
    if (!this.portalVisual || open === this.lastPortalOpen) return;
    this.lastPortalOpen = open;
    this.portalVisual.ring.setFillStyle(open ? 0x22c55e : 0x64748b, 0.35);
    this.portalVisual.ring.setStrokeStyle(3.5, open ? 0x86efac : 0x94a3b8);
    this.portalVisual.core.setFillStyle(open ? 0x16a34a : 0x475569, 0.95);
    this.portalVisual.label.setText(open ? '★' : '🔒');
  }

  sync(snapshot: MazeEngineSnapshot, timeMs: number, reducedMotion: boolean): void {
    this.updatePortalState(snapshot.portalOpen);
    if (this.portalVisual && snapshot.portalOpen && !reducedMotion) {
      const pulse = 1 + Math.sin(timeMs * 0.006) * 0.08;
      this.portalVisual.ring.setScale(pulse);
    }

    this.syncCollectibles(snapshot.collectibles, timeMs, reducedMotion);
    this.syncBubbles(snapshot.activeBubbles, timeMs, reducedMotion);
    this.syncWaves(snapshot.activeWaves);
  }

  private syncCollectibles(
    collectibles: MazeCollectible[],
    timeMs: number,
    reducedMotion: boolean
  ): void {
    const activeIds = new Set(collectibles.map((c) => c.id));

    for (const [id, node] of this.collectibleNodes.entries()) {
      if (!activeIds.has(id)) {
        node.destroy();
        this.collectibleNodes.delete(id);
      }
    }

    for (const item of collectibles) {
      let node = this.collectibleNodes.get(item.id);
      const cx = (item.col + 0.5) * MAZE_TILE_SIZE;
      const cy = (item.row + 0.5) * MAZE_TILE_SIZE;

      if (!node) {
        node = this.createCollectibleNode(item, cx, cy);
        this.collectibleNodes.set(item.id, node);
      }

      const bob = reducedMotion ? 0 : Math.sin(timeMs * 0.005 + item.col * 0.7) * 3;
      node.setPosition(cx, cy + bob);
      node.setDepth(cy - 3);
    }
  }

  private createCollectibleNode(
    item: MazeCollectible,
    cx: number,
    cy: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(cx, cy);

    if (item.kind === 'star_orb') {
      const orb = this.scene.add.image(0, 0, 'maze-star-orb').setScale(0.75);
      container.add(orb);
    } else if (item.kind === 'syllable_seal') {
      const glow = this.scene.add.circle(0, 0, 21, 0xfde047, 0.35);
      const disc = this.scene.add.circle(0, 0, 18, 0x0f172a, 0.92).setStrokeStyle(3, 0xfacc15);
      const label = this.scene.add
        .text(0, 0, item.token ?? '?', {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: (item.token?.length ?? 0) > 2 ? '13px' : '16px',
          fontStyle: 'bold',
          color: '#fef08a',
        })
        .setOrigin(0.5);
      container.add([glow, disc, label]);
    } else if (item.kind === 'power_up') {
      const info = POWERUP_BADGE_MAP[item.powerUpKind ?? 'extra_bubble'];
      const colorNum = Phaser.Display.Color.HexStringToColor(info.color).color;
      const box = this.scene.add
        .rectangle(0, 0, 32, 32, colorNum, 0.95)
        .setStrokeStyle(2.5, 0x0f172a);
      const label = this.scene.add
        .text(0, 0, info.label, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#0f172a',
        })
        .setOrigin(0.5);
      container.add([box, label]);
    }

    return container;
  }

  private syncBubbles(
    bubbles: ActiveBubble[],
    timeMs: number,
    reducedMotion: boolean
  ): void {
    const activeIds = new Set(bubbles.map((b) => b.id));

    for (const [id, node] of this.bubbleNodes.entries()) {
      if (!activeIds.has(id)) {
        node.destroy();
        this.bubbleNodes.delete(id);
      }
    }

    for (const bubble of bubbles) {
      const cx = (bubble.col + 0.5) * MAZE_TILE_SIZE;
      const cy = (bubble.row + 0.5) * MAZE_TILE_SIZE;
      let node = this.bubbleNodes.get(bubble.id);

      if (!node) {
        const body = this.scene.add
          .circle(0, 0, 19, 0x38bdf8, 0.72)
          .setStrokeStyle(3, 0xe0f2fe);
        const shine = this.scene.add.circle(-6, -6, 5, 0xffffff, 0.65);
        node = this.scene.add.container(cx, cy, [body, shine]);
        this.bubbleNodes.set(bubble.id, node);
      }

      const ratio = 1 - Math.max(0, bubble.remainingMs) / bubble.fuseMs;
      const pulseSpeed = 0.012 + ratio * 0.025;
      const scale = reducedMotion ? 1 : 0.94 + Math.sin(timeMs * pulseSpeed) * (0.08 + ratio * 0.09);
      node.setPosition(cx, cy);
      node.setScale(scale);
      node.setDepth(cy + 2);
    }
  }

  private syncWaves(waves: ActiveWave[]): void {
    const activeIds = new Set(waves.map((w) => w.id));

    for (const [id, node] of this.waveNodes.entries()) {
      if (!activeIds.has(id)) {
        node.destroy();
        this.waveNodes.delete(id);
      }
    }

    for (const wave of waves) {
      let node = this.waveNodes.get(wave.id);
      if (!node) {
        node = this.scene.add.container(0, 0);
        for (const tile of wave.tiles) {
          const tx = (tile.col + 0.5) * MAZE_TILE_SIZE;
          const ty = (tile.row + 0.5) * MAZE_TILE_SIZE;
          const outer = this.scene.add
            .rectangle(tx, ty, MAZE_TILE_SIZE - 8, MAZE_TILE_SIZE - 8, 0x38bdf8, 0.55)
            .setStrokeStyle(2, 0xe0f2fe);
          const inner = this.scene.add.circle(tx, ty, 12, 0xfef08a, 0.75);
          node.add([outer, inner]);
        }
        node.setDepth(2000);
        this.waveNodes.set(wave.id, node);
      }

      const alpha = Math.max(0.2, Math.min(1, wave.remainingMs / 450));
      node.setAlpha(alpha);
    }
  }

  /**
   * Sincroniza la representación 2.5D y estado visual (normal/stunned/frightened) de enemigos.
   */
  syncEnemies(
    enemies: EnemyRuntimeState[],
    timeMs: number,
    reducedMotion: boolean
  ): void {
    const activeIds = new Set(enemies.map((e) => e.id));

    for (const [id, entry] of this.enemyNodes.entries()) {
      if (!activeIds.has(id)) {
        entry.container.destroy();
        this.enemyNodes.delete(id);
      }
    }

    for (const enemy of enemies) {
      const cx = (enemy.x + 0.5) * MAZE_TILE_SIZE;
      const cy = (enemy.y + 0.5) * MAZE_TILE_SIZE;
      let entry = this.enemyNodes.get(enemy.id);

      if (!entry) {
        const style = ENEMY_STYLE_MAP[enemy.kind];
        const shadow = this.scene.add.ellipse(0, 15, 30, 12, 0x0f172a, 0.34);
        const body = this.scene.add
          .circle(0, -2, 18, style.bodyColor, 0.96)
          .setStrokeStyle(2.5, 0x0f172a);
        const icon = this.scene.add
          .text(0, -2, style.emoji, {
            fontFamily: 'Lexend, system-ui, sans-serif',
            fontSize: '18px',
          })
          .setOrigin(0.5);
        const statusTag = this.scene.add
          .text(0, -26, '', {
            fontFamily: 'Lexend, system-ui, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#fef08a',
            stroke: '#0f172a',
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        const container = this.scene.add.container(cx, cy, [shadow, body, icon, statusTag]);
        entry = { container, body, statusTag };
        this.enemyNodes.set(enemy.id, entry);
      }

      const style = ENEMY_STYLE_MAP[enemy.kind];
      const bob =
        reducedMotion || enemy.state === 'stunned'
          ? 0
          : Math.sin(timeMs * 0.008 + enemy.x) * 2.5;

      entry.container.setPosition(cx, cy + bob);
      entry.container.setDepth(cy + 4);

      if (enemy.state === 'stunned') {
        entry.body.setFillStyle(0x94a3b8, 0.85);
        entry.container.setAlpha(0.75);
        entry.statusTag.setText('💫');
      } else if (enemy.state === 'frightened') {
        entry.body.setFillStyle(0x38bdf8, 0.95);
        entry.container.setAlpha(1);
        entry.statusTag.setText('!');
      } else {
        entry.body.setFillStyle(style.bodyColor, 0.96);
        entry.container.setAlpha(1);
        entry.statusTag.setText('');
      }
    }
  }

  /**
   * Sincroniza la representación visual 2.5D y barra de corazones del jefe de capítulo.
   */
  syncBoss(
    boss: BossRuntimeState | null,
    timeMs: number,
    reducedMotion: boolean
  ): void {
    if (!boss || boss.state === 'defeated') {
      if (this.bossNode) {
        this.bossNode.container.destroy();
        this.bossNode = null;
      }
      return;
    }

    const cx = (boss.x + 0.5) * MAZE_TILE_SIZE;
    const cy = (boss.y + 0.5) * MAZE_TILE_SIZE;

    if (!this.bossNode) {
      const shadow = this.scene.add.ellipse(0, 20, 44, 16, 0x0f172a, 0.42);
      const body = this.scene.add
        .circle(0, -4, 24, 0xdc2626, this.scene.textures.exists(boss.id) ? 0.25 : 0.96)
        .setStrokeStyle(3.5, 0xfacc15);
      const emblem: Phaser.GameObjects.GameObject = this.scene.textures.exists(boss.id)
        ? this.scene.add.image(0, -5, boss.id).setScale(0.185)
        : this.scene.add
            .text(0, -6, '👑', {
              fontFamily: 'Lexend, system-ui, sans-serif',
              fontSize: '20px',
            })
            .setOrigin(0.5);
      const hpTag = this.scene.add
        .text(0, -34, '', {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#fef08a',
          stroke: '#0f172a',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      const statusTag = this.scene.add
        .text(0, 22, boss.name, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#0f172acc',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5);

      const container = this.scene.add.container(cx, cy, [
        shadow,
        body,
        emblem,
        hpTag,
        statusTag,
      ]);
      this.bossNode = { container, body, hpTag, statusTag };
    }

    const bob =
      reducedMotion || boss.state === 'stunned' ? 0 : Math.sin(timeMs * 0.009) * 3;
    this.bossNode.container.setPosition(cx, cy + bob);
    this.bossNode.container.setDepth(cy + 8);
    this.bossNode.hpTag.setText(
      `${'♥'.repeat(boss.hp)}${'♡'.repeat(Math.max(0, boss.maxHp - boss.hp))}`
    );

    if (boss.state === 'stunned') {
      this.bossNode.body.setFillStyle(0x94a3b8, 0.85);
      this.bossNode.statusTag.setText('💫 ¡Aturdido!');
    } else if (boss.state === 'dashing') {
      this.bossNode.body.setFillStyle(0xf97316, 0.98);
      this.bossNode.statusTag.setText(`⚡ ${boss.name}`);
    } else {
      this.bossNode.body.setFillStyle(0xdc2626, 0.96);
      this.bossNode.statusTag.setText(boss.name);
    }
  }
}
