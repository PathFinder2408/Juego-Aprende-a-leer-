import Phaser from 'phaser';
import { speakText } from '../../audio/speech';
import { getPlayerSkinConfig } from '../../config/skins';
import wordsData from '../../data/words.json';
import worldData from '../../data/world.json';
import { gameBus } from '../../events/bus';
import type { WordEntry, WorldConfig } from '../../types/game';
import { loadSaveState } from '../persistence/saveStorage';
import { ensureWorldTextures, renderIslandTerrain } from './islandRenderer';
import { WorldPlayer } from './WorldPlayer';

interface WildCreatureActor {
  wordEntry: WordEntry;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  badge: Phaser.GameObjects.Text;
  baseY: number;
  triggered: boolean;
}

export class WorldScene extends Phaser.Scene {
  private player!: WorldPlayer;
  private wildActors: WildCreatureActor[] = [];
  private dynamicProps: Array<{ sprite: Phaser.Physics.Matter.Image; shadow: Phaser.GameObjects.Ellipse }> = [];
  private tapMarker!: Phaser.GameObjects.Arc;
  private encounterGraceUntil = 0;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    this.cleanupBusEvents();

    const world = worldData as WorldConfig;
    const words = wordsData as WordEntry[];
    this.wildActors = [];
    this.dynamicProps = [];
    this.encounterGraceUntil = this.time.now + 800;

    ensureWorldTextures(this);
    this.matter.world.setGravity(0, 0);
    this.matter.world.setBounds(75, 75, world.width - 150, world.height - 150, 64);

    this.tapMarker = renderIslandTerrain(this, world);
    this.spawnProps(world);
    this.spawnWildCreatures(world, words);

    const playerSkin = getPlayerSkinConfig(loadSaveState().playerSkin);
    this.player = new WorldPlayer(this, world.spawn.x, world.spawn.y, playerSkin.textureKey);

    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.registerPointerNavigation();
    this.unsubscribers.push(
      gameBus.on('player:skin', (skinId) => {
        if (!this.sys || !this.sys.isActive()) return;
        const nextSkin = getPlayerSkinConfig(skinId);
        this.player?.setTextureKey(nextSkin.textureKey);
      })
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBusEvents, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupBusEvents, this);
  }

  private cleanupBusEvents(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  update(time: number, delta: number): void {
    this.player.update(this, delta);

    // Actualizar sombras y Y-sort de props físicos empujables
    for (const prop of this.dynamicProps) {
      prop.shadow.setPosition(prop.sprite.x, prop.sprite.y + prop.sprite.displayHeight * 0.36);
      prop.shadow.setDepth(prop.sprite.y - 1);
      prop.sprite.setDepth(prop.sprite.y);
    }

    // Animar criaturas salvajes y detectar proximidad de encuentro
    for (const actor of this.wildActors) {
      if (actor.triggered) continue;

      const bob = Math.sin(time * 0.004 + actor.sprite.x) * 5;
      actor.sprite.y = actor.baseY + bob;
      actor.badge.setPosition(actor.sprite.x, actor.baseY - 46 + bob * 0.5);
      actor.shadow.setDepth(actor.baseY - 1);
      actor.sprite.setDepth(actor.baseY);
      actor.badge.setDepth(actor.baseY + 40);

      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        actor.sprite.x,
        actor.baseY
      );

      if (dist < 145) {
        actor.badge.setText(`¡${actor.wordEntry.creatureName}! (${actor.wordEntry.word})`);
        actor.badge.setBackgroundColor('#facc15');
        actor.badge.setColor('#0f172a');
      }

      if (dist < 76 && time >= this.encounterGraceUntil) {
        actor.triggered = true;
        this.player.clearMoveTarget();
        speakText(`¡Hola ${actor.wordEntry.creatureName}!`, { rate: 0.95 });
        gameBus.emit('encounter:start', { wordId: actor.wordEntry.id });
      }
    }
  }

  private spawnProps(world: WorldConfig): void {
    for (const prop of world.props) {
      if (prop.kind === 'palm') {
        this.add.ellipse(prop.x, prop.y + 4, 90, 32, 0x0f172a, 0.25).setDepth(prop.y - 2);
        const palm = this.add
          .image(prop.x, prop.y + 8, 'palm-tree')
          .setOrigin(0.5, 0.92)
          .setScale(0.68);
        palm.setDepth(prop.y);

        // Colisionador estático solo en la base del tronco
        this.matter.add.circle(prop.x, prop.y - 4, 18, {
          isStatic: true,
          label: `palm:${prop.id}`,
        });
      } else if (prop.kind === 'grass') {
        const grass = this.add.image(prop.x, prop.y + 12, 'prop-grass').setDepth(prop.y - 10);
        this.tweens.add({
          targets: grass,
          scaleX: { from: 0.97, to: 1.04 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (prop.kind === 'ball' || prop.kind === 'coconut') {
        const isBall = prop.kind === 'ball';
        const key = isBall ? 'prop-ball' : 'prop-coconut';
        const radius = isBall ? 24 : 16;
        const shadow = this.add.ellipse(prop.x, prop.y + radius, radius * 1.6, radius * 0.7, 0x0f172a, 0.25);
        const sprite = this.matter.add.image(prop.x, prop.y, key, undefined, {
          shape: { type: 'circle', radius },
          restitution: 0.88,
          frictionAir: 0.035,
          density: isBall ? 0.0012 : 0.002,
          label: `prop:${prop.id}`,
        });
        this.dynamicProps.push({ sprite, shadow });
      }
    }
  }

  private spawnWildCreatures(world: WorldConfig, words: WordEntry[]): void {
    for (const spawn of world.wildSpawns) {
      const entry = words.find((w) => w.id === spawn.wordId);
      if (!entry) continue;

      const texKey = `creature-${entry.id}`;
      const shadow = this.add.ellipse(spawn.x, spawn.y + 28, 52, 18, 0x0f172a, 0.28);
      const sprite = this.add
        .image(spawn.x, spawn.y, this.textures.exists(texKey) ? texKey : 'explorer')
        .setScale(0.24);

      const badge = this.add
        .text(spawn.x, spawn.y - 46, `${entry.creatureName} · Nivel ${entry.level}`, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#f8fafc',
          backgroundColor: '#0f172acc',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5);

      this.wildActors.push({
        wordEntry: entry,
        sprite,
        shadow,
        badge,
        baseY: spawn.y,
        triggered: false,
      });
    }
  }

  private registerPointerNavigation(): void {
    const updateTap = (pointer: Phaser.Input.Pointer) => {
      const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.player.setMoveTarget(worldPt.x, worldPt.y);
      this.tapMarker.setPosition(worldPt.x, worldPt.y).setVisible(true).setScale(0.7).setAlpha(0.95);
      this.tweens.killTweensOf(this.tapMarker);
      this.tweens.add({
        targets: this.tapMarker,
        scale: 1.35,
        alpha: 0,
        duration: 420,
        onComplete: () => this.tapMarker.setVisible(false),
      });
    };

    this.input.on('pointerdown', updateTap);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.player.setMoveTarget(worldPt.x, worldPt.y);
      }
    });
  }
}
