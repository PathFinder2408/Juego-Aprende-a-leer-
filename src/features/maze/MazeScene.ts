import Phaser from 'phaser';
import { playBubblePop, playCaptureFanfare, playCorrectChime, playSoftBounce } from '../../audio/sfx';
import { speakText } from '../../audio/speech';
import { DEFAULT_ACCESSIBILITY_SETTINGS, SLOW_FLOATING_MULTIPLIER } from '../../config/accessibility';
import { getPlayerSkinConfig } from '../../config/skins';
import { CHAPTER_1_MAPS, getMazeMapById } from '../../data/maps';
import { gameBus } from '../../events/bus';
import type {
  AccessibilitySettings,
  ArcadeHudSnapshot,
  DomeChallengeMode,
} from '../../types/game';
import { getEquippedCardPower } from '../album/albumLogic';
import { universalInput } from '../input/InputController';
import { loadSaveState } from '../persistence/saveStorage';
import {
  createBossState,
  getBossById,
  stepBoss,
  type BossEvent,
  type BossRuntimeState,
} from './bossBehavior';
import {
  createEnemyGridContext,
  createEnemyStates,
  resolveEnemyContacts,
  stepEnemies,
  type EnemyAIEvent,
  type EnemyRuntimeState,
} from './enemyAI';
import {
  DEFAULT_PLAYER_SPEED_TILES_PER_SEC,
  MazeEngine,
  type MazeEngineSnapshot,
  type MazeEvent,
} from './mazeEngine';
import { MazePlayer } from './MazePlayer';
import { MAZE_TILE_SIZE, MazeRenderer } from './MazeRenderer';
import {
  applyPlayerEnemyHit,
  applySurvivalPowerUp,
  createSurvivalState,
  stepSurvivalTimers,
  type MazeSurvivalState,
} from './powerups';

export interface MazeSceneInitData {
  mapId?: string;
  stageId?: string;
  stageTitle?: string;
  wordIds?: string[];
  sentenceIds?: string[];
  mode?: DomeChallengeMode;
  bossId?: string;
  equippedCardId?: string | null;
}

export class MazeScene extends Phaser.Scene {
  private engine!: MazeEngine;
  private mazeRenderer!: MazeRenderer;
  private mazePlayer!: MazePlayer;
  private enemies: EnemyRuntimeState[] = [];
  private boss: BossRuntimeState | null = null;
  private survival: MazeSurvivalState = createSurvivalState();
  private accessibility: AccessibilitySettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  private unsubscribers: Array<() => void> = [];
  private detachInput: (() => void) | null = null;

  private stageId = 'ch1-1';
  private stageTitle = 'Playa Amanecer 1';
  private mapId = 'map-ch1-1';
  private wordIds: string[] = ['sol'];
  private sentenceIds: string[] = [];
  private mode: DomeChallengeMode = 'word';
  private bossId: string | undefined = undefined;
  private equippedCardId: string | null = null;

  private paused = false;
  private portalTriggered = false;
  private lastHudKey = '';
  private tutorialBanner: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'MazeScene' });
  }

  init(data?: MazeSceneInitData): void {
    this.mapId = data?.mapId ?? 'map-ch1-1';
    this.stageId = data?.stageId ?? 'ch1-1';
    this.stageTitle = data?.stageTitle ?? 'Playa Amanecer 1';
    this.wordIds = data?.wordIds?.length ? [...data.wordIds] : ['sol'];
    this.sentenceIds = data?.sentenceIds ? [...data.sentenceIds] : [];
    this.mode = data?.mode ?? 'word';
    this.bossId = data?.bossId;
    this.equippedCardId = data?.equippedCardId ?? null;
  }

  create(): void {
    this.cleanupScene();

    const savedState = loadSaveState();
    this.accessibility = savedState.accessibility;
    const playerSkin = getPlayerSkinConfig(savedState.playerSkin);
    this.paused = false;
    this.portalTriggered = false;
    this.lastHudKey = '';

    const stageOrderMatch = /-(\d+|boss)$/.exec(this.stageId);
    const templateIdx =
      stageOrderMatch?.[1] === 'boss'
        ? 4
        : Math.max(0, Math.min(3, Number(stageOrderMatch?.[1] ?? 1) - 1));
    const mapConfig =
      getMazeMapById(this.mapId) ?? CHAPTER_1_MAPS[templateIdx] ?? CHAPTER_1_MAPS[0];
    if (!mapConfig) {
      throw new Error(`No existe mapa de laberinto configurado (${this.mapId})`);
    }

    const cardPower = getEquippedCardPower(this.equippedCardId);
    const baseSpeed = this.getTargetPlayerSpeed();
    this.engine = new MazeEngine(mapConfig, {
      playerSpeedTilesPerSec: baseSpeed,
      initialMaxBubbles: cardPower === 'extra_bubble' ? 2 : 1,
      initialWaveRange: cardPower === 'long_wave' ? 2 : 1,
    });
    this.enemies = createEnemyStates(mapConfig.enemies);
    this.survival = createSurvivalState();
    if (cardPower === 'solar_shield_start') {
      this.survival = { ...this.survival, hasSolarShield: true };
    }

    const bossConfig = this.bossId ? getBossById(this.bossId) : undefined;
    if (bossConfig) {
      const bossSpawn = mapConfig.bossSpawn ?? {
        col: Math.floor(mapConfig.cols / 2),
        row: Math.floor(mapConfig.rows / 2),
      };
      this.boss = createBossState(bossConfig, bossSpawn);
    } else {
      this.boss = null;
    }

    const initialSnapshot = this.engine.getState();
    this.mazeRenderer = new MazeRenderer(this, initialSnapshot, this.accessibility.highContrast);
    this.mazePlayer = new MazePlayer(
      this,
      initialSnapshot.player,
      MAZE_TILE_SIZE,
      playerSkin.textureKey
    );
    this.mazeRenderer.syncEnemies(this.enemies, this.time.now, this.accessibility.reducedMotion);
    this.mazeRenderer.syncBoss(this.boss, this.time.now, this.accessibility.reducedMotion);

    this.configureCamera(initialSnapshot.cols, initialSnapshot.rows);
    this.registerInputAndBus();
    this.registerLifecycleCleanup();

    if (this.stageId === 'ch1-1') {
      this.showTutorialBanner();
    }

    this.emitHudSnapshot(initialSnapshot);
  }

  update(time: number, delta: number): void {
    const input = universalInput.sample(Date.now());

    if (input.pausePressed) {
      this.paused = !this.paused;
      gameBus.emit('maze:pause', this.paused);
      this.emitHudSnapshot(this.engine.getState());
    }

    if (this.paused || this.portalTriggered) {
      this.mazeRenderer.sync(this.engine.getState(), time, this.accessibility.reducedMotion);
      this.mazeRenderer.syncEnemies(this.enemies, time, this.accessibility.reducedMotion);
      this.mazeRenderer.syncBoss(this.boss, time, this.accessibility.reducedMotion);
      return;
    }

    const dtSec = Math.min(Math.max(delta, 0), 50) / 1000;
    this.survival = stepSurvivalTimers(this.survival, dtSec * 1000);

    const result = this.engine.step(dtSec, {
      direction: input.direction,
      placeBubble: input.bubblePressed,
    });

    this.handleEngineEvents(result.events);

    const cardPower = getEquippedCardPower(this.equippedCardId);
    if (cardPower === 'syllable_magnet') {
      const magnetEvents: MazeEvent[] = [];
      this.engine.collectNearbyCollectibles(input.powerPressed ? 2.6 : 1.5, magnetEvents);
      if (magnetEvents.length > 0) {
        this.handleEngineEvents(magnetEvents);
      }
    } else if (input.powerPressed && cardPower === 'audio_hint') {
      const nextSeal = this.engine
        .getCollectibles()
        .find((c) => c.kind === 'syllable_seal' && c.token);
      if (nextSeal?.token) {
        speakText(`Busca la sílaba ${nextSeal.token}`, { rate: 0.9 });
      }
    }

    const enemyCtx = createEnemyGridContext(
      result.snapshot,
      this.survival.frightenedRemainingMs > 0
    );
    const enemyEvents = stepEnemies(this.enemies, enemyCtx, dtSec);
    const contactEvents = resolveEnemyContacts(this.enemies, enemyCtx);
    this.handleEnemyEvents([...enemyEvents, ...contactEvents]);

    if (this.boss) {
      const bossEvents = stepBoss(this.boss, enemyCtx, dtSec);
      this.handleBossEvents(bossEvents);
    }

    const latestSnapshot = this.engine.getState();
    this.mazeRenderer.sync(latestSnapshot, time, this.accessibility.reducedMotion);
    this.mazeRenderer.syncEnemies(this.enemies, time, this.accessibility.reducedMotion);
    this.mazeRenderer.syncBoss(this.boss, time, this.accessibility.reducedMotion);
    this.mazePlayer.sync(latestSnapshot.player, delta, this.accessibility.reducedMotion, {
      hasSolarShield: this.survival.hasSolarShield,
      invulnerable: this.survival.invulnerableRemainingMs > 0,
    });
    this.emitHudSnapshot(latestSnapshot);
  }

  private getTargetPlayerSpeed(): number {
    return this.accessibility.slowFloating
      ? DEFAULT_PLAYER_SPEED_TILES_PER_SEC * SLOW_FLOATING_MULTIPLIER
      : DEFAULT_PLAYER_SPEED_TILES_PER_SEC;
  }

  private configureCamera(cols: number, rows: number): void {
    const worldWidth = cols * MAZE_TILE_SIZE;
    const worldHeight = rows * MAZE_TILE_SIZE;
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    const boundX = worldWidth < viewW ? -(viewW - worldWidth) / 2 : 0;
    const boundY = worldHeight < viewH ? -(viewH - worldHeight) / 2 : 0;
    const boundW = Math.max(worldWidth, viewW);
    const boundH = Math.max(worldHeight, viewH);

    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(boundX, boundY, boundW, boundH);
    this.cameras.main.startFollow(this.mazePlayer.sprite, true, 0.16, 0.16);
  }

  private registerInputAndBus(): void {
    universalInput.reset();
    this.detachInput = universalInput.attachToWindow();

    this.unsubscribers.push(
      gameBus.on('accessibility:update', (settings) => {
        this.accessibility = { ...settings };
        this.engine.setPlayerSpeed(this.getTargetPlayerSpeed());
        this.mazeRenderer.setHighContrast(settings.highContrast, this.engine.getState());
      })
    );

    this.unsubscribers.push(
      gameBus.on('maze:pause', (paused) => {
        this.paused = paused;
        this.emitHudSnapshot(this.engine.getState());
      }),
      gameBus.on('player:skin', (skinId) => {
        const nextSkin = getPlayerSkinConfig(skinId);
        this.mazePlayer?.setTextureKey(nextSkin.textureKey);
      })
    );
  }

  private registerLifecycleCleanup(): void {
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupScene, this);
    this.game.events.off(Phaser.Core.Events.DESTROY, this.cleanupScene, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupScene, this);
    this.game.events.once(Phaser.Core.Events.DESTROY, this.cleanupScene, this);
  }

  private cleanupScene(): void {
    if (this.tutorialBanner) {
      this.tutorialBanner.destroy();
      this.tutorialBanner = null;
    }
    if (this.detachInput) {
      this.detachInput();
      this.detachInput = null;
    }
    universalInput.reset();

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private handleEngineEvents(events: MazeEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'bubble_placed':
          playSoftBounce();
          this.mazePlayer.playBubbleDropBounce();
          break;
        case 'wave_triggered':
          playBubblePop();
          break;
        case 'block_damaged':
          this.mazeRenderer.updateBlockTile(ev.point, ev.remainingHp, ev.destroyed);
          break;
        case 'orb_collected':
          playCorrectChime(0);
          break;
        case 'seal_collected':
          playCorrectChime(ev.collectedSeals);
          speakText(ev.token, { rate: 0.88 });
          break;
        case 'powerup_collected': {
          const powerRes = applySurvivalPowerUp(this.survival, ev.kind);
          this.survival = powerRes.state;
          playCorrectChime(3);
          speakText(powerRes.speechText, { rate: 0.95 });
          break;
        }
        case 'portal_opened':
          playCaptureFanfare();
          speakText('¡Portal abierto!', { rate: 0.95 });
          break;
        case 'warped':
          this.mazePlayer.playWarpFlash(this, this.accessibility.reducedMotion);
          playSoftBounce();
          break;
        case 'portal_entered':
          if (!this.portalTriggered) {
            this.portalTriggered = true;
            playCaptureFanfare();
            universalInput.reset();
            gameBus.emit('maze:portal', {
              stageId: this.stageId,
              wordIds: this.wordIds,
              sentenceIds: this.sentenceIds,
              mode: this.mode,
            });
          }
          break;
        case 'item_revealed':
          break;
      }
    }
  }

  private applySurvivalHazardHit(): void {
    const hit = applyPlayerEnemyHit(this.survival);
    this.survival = hit.state;
    if (hit.ignoredByInvulnerability) return;

    playSoftBounce();
    if (hit.absorbedByShield) {
      speakText('¡Escudo solar!', { rate: 0.95 });
    } else if (hit.checkpointTriggered) {
      this.engine.respawnPlayerAtCheckpoint();
      speakText('¡De vuelta al inicio!', { rate: 0.95 });
    }
  }

  private handleEnemyEvents(events: EnemyAIEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'enemy_stunned':
          this.engine.addBonusScore(ev.scoreGained);
          playCorrectChime(1);
          break;
        case 'enemy_caught_frightened':
          this.engine.addBonusScore(ev.scoreGained);
          playCorrectChime(2);
          speakText('¡Atrapado!', { rate: 1.0 });
          break;
        case 'player_touched_enemy':
          this.applySurvivalHazardHit();
          break;
        case 'enemy_recovered':
        case 'enemy_frightened_started':
          break;
      }
    }
  }

  private handleBossEvents(events: BossEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'boss_hit':
          this.engine.addBonusScore(ev.scoreGained);
          playCorrectChime(2);
          break;
        case 'boss_defeated':
          this.engine.addBonusScore(ev.scoreGained);
          this.engine.unlockPortalByBoss();
          playCaptureFanfare();
          speakText(`¡${ev.name} calmado! ¡Portal abierto!`, { rate: 0.95 });
          break;
        case 'boss_ability_used':
          for (const pt of ev.candidateBlocks) {
            if (this.engine.placeMuteBlock(pt.col, pt.row)) {
              this.mazeRenderer.spawnMuteBlock(pt);
            }
          }
          playSoftBounce();
          break;
        case 'player_touched_boss':
          this.applySurvivalHazardHit();
          break;
      }
    }
  }

  private emitHudSnapshot(snapshot: MazeEngineSnapshot): void {
    const frightenedBucketMs =
      this.survival.frightenedRemainingMs > 0
        ? Math.ceil(this.survival.frightenedRemainingMs / 500) * 500
        : 0;

    const hudKey = [
      this.stageId,
      this.survival.hearts,
      this.survival.maxHearts,
      this.survival.hasSolarShield ? 1 : 0,
      frightenedBucketMs,
      snapshot.activeBubbles.length,
      snapshot.player.maxBubbles,
      snapshot.player.waveRange,
      snapshot.collectedSeals,
      snapshot.totalSeals,
      snapshot.portalOpen ? 1 : 0,
      snapshot.score,
      this.paused ? 1 : 0,
    ].join('|');

    if (hudKey === this.lastHudKey) return;
    this.lastHudKey = hudKey;

    const hud: ArcadeHudSnapshot = {
      stageId: this.stageId,
      stageTitle: this.stageTitle,
      hearts: this.survival.hearts,
      maxHearts: this.survival.maxHearts,
      hasSolarShield: this.survival.hasSolarShield,
      maxBubbles: snapshot.player.maxBubbles,
      activeBubbles: snapshot.activeBubbles.length,
      waveRange: snapshot.player.waveRange,
      collectedSeals: snapshot.collectedSeals,
      totalSeals: snapshot.totalSeals,
      portalOpen: snapshot.portalOpen,
      score: snapshot.score,
      frightenedRemainingMs: this.survival.frightenedRemainingMs,
      paused: this.paused,
      equippedCardId: this.equippedCardId,
    };

    gameBus.emit('maze:hud', hud);
  }

  private showTutorialBanner(): void {
    const isHc = this.accessibility.highContrast;
    const isRm = this.accessibility.reducedMotion;

    const bannerW = Math.min(this.scale.width - 32, 540);
    const bannerH = 74;
    const bannerX = this.scale.width / 2;
    const bannerY = 88;

    const container = this.add.container(bannerX, bannerY);
    container.setScrollFactor(0);
    container.setDepth(9999);

    const bg = this.add.graphics();
    bg.fillStyle(isHc ? 0x000000 : 0x0f172a, isHc ? 0.98 : 0.9);
    bg.lineStyle(2, isHc ? 0xfacc15 : 0x38bdf8, 1);
    bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);
    bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 12);
    container.add(bg);

    const titleText = this.add.text(
      0,
      -14,
      '🎮 ¡Usa Flechas / WASD o Táctil para moverte!',
      {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: isHc ? '#facc15' : '#38bdf8',
        align: 'center',
      }
    );
    titleText.setOrigin(0.5);
    container.add(titleText);

    const hintText = this.add.text(
      0,
      12,
      '🫧 ¡Presiona Espacio o Botón Burbuja para abrir paso!',
      {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
      }
    );
    hintText.setOrigin(0.5);
    container.add(hintText);

    this.tutorialBanner = container;

    speakText('¡Usa las flechas para moverte y espacio para soltar burbujas!', { rate: 0.95 });

    if (isRm) {
      this.time.delayedCall(7000, () => {
        if (this.tutorialBanner) {
          this.tutorialBanner.destroy();
          this.tutorialBanner = null;
        }
      });
    } else {
      container.setAlpha(0);
      this.tweens.add({
        targets: container,
        alpha: 1,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.time.delayedCall(6500, () => {
            if (this.tutorialBanner && !this.tutorialBanner.scene) return;
            if (this.tutorialBanner) {
              this.tweens.add({
                targets: this.tutorialBanner,
                alpha: 0,
                duration: 500,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                  if (this.tutorialBanner) {
                    this.tutorialBanner.destroy();
                    this.tutorialBanner = null;
                  }
                },
              });
            }
          });
        },
      });
    }
  }
}
