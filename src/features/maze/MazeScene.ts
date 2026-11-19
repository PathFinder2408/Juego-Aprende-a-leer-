import Phaser from 'phaser';
import { playCaptureFanfare, playCorrectChime, playSoftBounce } from '../../audio/sfx';
import { speakText } from '../../audio/speech';
import { DEFAULT_ACCESSIBILITY_SETTINGS, SLOW_FLOATING_MULTIPLIER } from '../../config/accessibility';
import { CHAPTER_1_MAPS, getMazeMapById } from '../../data/maps';
import { gameBus } from '../../events/bus';
import type {
  AccessibilitySettings,
  ArcadeHudSnapshot,
  DomeChallengeMode,
  PowerUpKind,
} from '../../types/game';
import { universalInput } from '../input/InputController';
import { loadSaveState } from '../persistence/saveStorage';
import {
  DEFAULT_PLAYER_SPEED_TILES_PER_SEC,
  MazeEngine,
  type MazeEngineSnapshot,
  type MazeEvent,
} from './mazeEngine';
import { MazePlayer } from './MazePlayer';
import { MAZE_TILE_SIZE, MazeRenderer } from './MazeRenderer';

export interface MazeSceneInitData {
  mapId?: string;
  stageId?: string;
  stageTitle?: string;
  wordIds?: string[];
  sentenceIds?: string[];
  mode?: DomeChallengeMode;
}

const POWERUP_SPEECH_MAP: Record<PowerUpKind, string> = {
  extra_bubble: 'Más burbujas',
  long_wave: 'Onda larga',
  turbo_boots: 'Botas turbo',
  solar_shield: 'Escudo solar',
  golden_orb: 'Orbe dorado',
};

export class MazeScene extends Phaser.Scene {
  private engine!: MazeEngine;
  private mazeRenderer!: MazeRenderer;
  private mazePlayer!: MazePlayer;
  private accessibility: AccessibilitySettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  private unsubscribers: Array<() => void> = [];
  private detachInput: (() => void) | null = null;

  private stageId = 'ch1-1';
  private stageTitle = 'Playa Amanecer 1';
  private mapId = 'map-ch1-1';
  private wordIds: string[] = ['sol'];
  private sentenceIds: string[] = [];
  private mode: DomeChallengeMode = 'word';

  private paused = false;
  private portalTriggered = false;
  private lastHudKey = '';

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
  }

  create(): void {
    this.cleanupScene();

    this.accessibility = loadSaveState().accessibility;
    this.paused = false;
    this.portalTriggered = false;
    this.lastHudKey = '';

    const mapConfig = getMazeMapById(this.mapId) ?? CHAPTER_1_MAPS[0];
    if (!mapConfig) {
      throw new Error(`No existe mapa de laberinto configurado (${this.mapId})`);
    }

    const baseSpeed = this.getTargetPlayerSpeed();
    this.engine = new MazeEngine(mapConfig, { playerSpeedTilesPerSec: baseSpeed });

    const initialSnapshot = this.engine.getState();
    this.mazeRenderer = new MazeRenderer(this, initialSnapshot, this.accessibility.highContrast);
    this.mazePlayer = new MazePlayer(this, initialSnapshot.player, MAZE_TILE_SIZE);

    this.configureCamera(initialSnapshot.cols, initialSnapshot.rows);
    this.registerInputAndBus();
    this.registerLifecycleCleanup();

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
      return;
    }

    const dtSec = Math.min(Math.max(delta, 0), 50) / 1000;
    const result = this.engine.step(dtSec, {
      direction: input.direction,
      placeBubble: input.bubblePressed,
    });

    this.handleEngineEvents(result.events);
    this.mazeRenderer.sync(result.snapshot, time, this.accessibility.reducedMotion);
    this.mazePlayer.sync(result.snapshot.player, delta, this.accessibility.reducedMotion);
    this.emitHudSnapshot(result.snapshot);
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
      })
    );

    this.unsubscribers.push(
      gameBus.on('maze:pause', (paused) => {
        this.paused = paused;
        this.emitHudSnapshot(this.engine.getState());
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
          playSoftBounce();
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
        case 'powerup_collected':
          playCorrectChime(3);
          speakText(POWERUP_SPEECH_MAP[ev.kind], { rate: 0.95 });
          break;
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

  private emitHudSnapshot(snapshot: MazeEngineSnapshot): void {
    const hudKey = [
      this.stageId,
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
      hearts: 3,
      maxHearts: 3,
      hasSolarShield: false,
      maxBubbles: snapshot.player.maxBubbles,
      activeBubbles: snapshot.activeBubbles.length,
      waveRange: snapshot.player.waveRange,
      collectedSeals: snapshot.collectedSeals,
      totalSeals: snapshot.totalSeals,
      portalOpen: snapshot.portalOpen,
      score: snapshot.score,
      frightenedRemainingMs: 0,
      paused: this.paused,
      equippedCardId: null,
    };

    gameBus.emit('maze:hud', hud);
  }
}
