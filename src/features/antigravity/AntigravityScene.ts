import Phaser from 'phaser';
import { playCaptureFanfare, playCorrectChime, playSoftBounce } from '../../audio/sfx';
import { speakText } from '../../audio/speech';
import { DEFAULT_ACCESSIBILITY_SETTINGS, SLOW_FLOATING_MULTIPLIER } from '../../config/accessibility';
import { DEFAULT_PHYSICS_PARAMS } from '../../config/physics';
import sentencesData from '../../data/sentences.json';
import wordsData from '../../data/words.json';
import { gameBus } from '../../events/bus';
import type {
  AccessibilitySettings,
  DomeChallengeMode,
  PhysicsParams,
  SentenceEntry,
  WordEntry,
} from '../../types/game';
import { loadSaveState } from '../persistence/saveStorage';
import { adaptiveEngine } from '../progression/adaptiveEngine';
import { LetterBody } from './LetterBody';
import { PlayerBumper } from './PlayerBumper';
import {
  PuzzleTracker,
  challengeFromSentence,
  challengeFromWord,
  type DomeChallenge,
} from './puzzleLogic';

const SCENE_WIDTH = 800;
const SCENE_HEIGHT = 600;
const DOME_CENTER_X = 400;
const DOME_CENTER_Y = 340;
const DOME_RADIUS = 225;
const DOME_SEGMENTS = 28;
const SLOT_Y = 58;

export class AntigravityScene extends Phaser.Scene {
  private physicsParams: PhysicsParams = { ...DEFAULT_PHYSICS_PARAMS };
  private accessibility: AccessibilitySettings = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  private letters: LetterBody[] = [];
  private player: PlayerBumper | null = null;
  private tracker!: PuzzleTracker;
  private activeEntry!: WordEntry;
  private activeChallenge!: DomeChallenge;
  private slotPositions: Array<{ x: number; y: number }> = [];
  private slotBoxes: Phaser.GameObjects.Rectangle[] = [];
  private creatureBubble!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private unsubscribers: Array<() => void> = [];
  private collisionGraceUntil = 0;
  private requestedWordId: string | null = null;
  private requestedSentenceId: string | null = null;
  private requestedMode: DomeChallengeMode | null = null;

  constructor() {
    super({ key: 'AntigravityScene' });
  }

  init(data?: { wordId?: string; sentenceId?: string; mode?: DomeChallengeMode }): void {
    this.requestedWordId = data?.wordId ?? null;
    this.requestedSentenceId = data?.sentenceId ?? null;
    this.requestedMode = data?.mode ?? null;
  }

  create(): void {
    const entries = wordsData as WordEntry[];
    const sentences = sentencesData as SentenceEntry[];
    const selectedEntry =
      (this.requestedWordId ? entries.find((e) => e.id === this.requestedWordId) : undefined) ??
      entries[0];
    if (!selectedEntry) {
      throw new Error('No hay palabras configuradas en src/data/words.json');
    }

    const selectedSentence =
      this.requestedSentenceId && this.requestedMode !== 'word'
        ? sentences.find((s) => s.id === this.requestedSentenceId)
        : undefined;

    this.cleanupBusEvents();
    this.accessibility = loadSaveState().accessibility;
    this.activeEntry = selectedEntry;
    this.activeChallenge = selectedSentence
      ? challengeFromSentence(selectedSentence, selectedEntry)
      : challengeFromWord(selectedEntry);
    this.tracker = new PuzzleTracker(this.activeChallenge);
    this.letters = [];
    this.slotPositions = [];
    this.slotBoxes = [];
    this.collisionGraceUntil = this.time.now + 500;

    this.matter.world.setGravity(0, 0);
    this.createBackgroundAndDome();
    this.createWordSlots();
    this.createCreatureDisplay();
    this.createLetters();
    this.player = new PlayerBumper(this, DOME_CENTER_X, DOME_CENTER_Y + 130, this.physicsParams);

    if (this.activeChallenge.mode === 'comprehension') {
      const promptAudio = `${this.activeChallenge.storyContext ?? ''} ${this.activeChallenge.promptText ?? ''}`.trim();
      if (promptAudio) {
        this.time.delayedCall(260, () => {
          speakText(promptAudio, { rate: 0.9 });
        });
      }
    } else if (this.activeChallenge.mode === 'sentence' && this.activeChallenge.promptText) {
      this.time.delayedCall(260, () => {
        speakText(this.activeChallenge.promptText ?? '', { rate: 0.92 });
      });
    }

    this.registerInput();
    this.registerCollisions();
    this.registerBusEvents();

    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBusEvents, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupBusEvents, this);
    this.game.events.off(Phaser.Core.Events.DESTROY, this.cleanupBusEvents, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBusEvents, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupBusEvents, this);
    this.game.events.once(Phaser.Core.Events.DESTROY, this.cleanupBusEvents, this);

    gameBus.emit('puzzle:state', this.tracker.getState());
    gameBus.emit('progression:update', adaptiveEngine.getSnapshot());
  }

  update(_time: number, delta: number): void {
    const slowMult = this.accessibility.slowFloating ? SLOW_FLOATING_MULTIPLIER : 1;
    const speedMult = adaptiveEngine.getCurrentConfig().speedMultiplier * slowMult;
    const effectiveParams: PhysicsParams = {
      ...this.physicsParams,
      maxSpeed: this.physicsParams.maxSpeed * speedMult,
      uprightStiffness: this.accessibility.reducedMotion
        ? Math.max(this.physicsParams.uprightStiffness, 0.12)
        : this.physicsParams.uprightStiffness,
    };
    for (const letter of this.letters) {
      letter.update(effectiveParams);
    }
    this.player?.update(this, delta, this.physicsParams);
  }

  private createBackgroundAndDome(): void {
    // Fondo crepuscular tropical-espacial con degradado suave
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0c4a6e, 0x0c4a6e, 0x0f172a, 0x1e1b4b, 1);
    bg.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

    // Estrellitas y motas de energía flotantes
    for (let i = 0; i < 28; i += 1) {
      const sx = ((i * 137) % (SCENE_WIDTH - 40)) + 20;
      const sy = ((i * 97) % (SCENE_HEIGHT - 40)) + 20;
      const star = this.add.circle(sx, sy, i % 3 === 0 ? 2.8 : 1.6, i % 4 === 0 ? 0xfef08a : 0xbae6fd, 0.45);
      if (i % 3 === 0) {
        this.tweens.add({
          targets: star,
          alpha: 0.15,
          duration: 1200 + (i % 5) * 300,
          yoyo: true,
          repeat: -1,
        });
      }
    }

    // Halo exterior pulsante de la cúpula de antigravedad
    const outerAura = this.add
      .circle(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS + 14, 0x38bdf8, 0.08)
      .setStrokeStyle(3, 0x38bdf8, 0.4);
    this.tweens.add({
      targets: outerAura,
      scale: { from: 0.99, to: 1.02 },
      alpha: { from: 0.7, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .circle(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS, 0x0f172a, 0.62)
      .setStrokeStyle(5, 0x7dd3fc, 0.9);
    this.add
      .circle(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS - 12, 0x38bdf8, 0.04)
      .setStrokeStyle(1.5, 0xbae6fd, 0.25);

    // Paredes estáticas en anillo circular para rebotes limpios
    const wallThickness = 28;
    const segmentLength = (2 * Math.PI * (DOME_RADIUS + wallThickness / 2)) / DOME_SEGMENTS + 8;

    for (let i = 0; i < DOME_SEGMENTS; i += 1) {
      const angle = (i / DOME_SEGMENTS) * Math.PI * 2;
      const r = DOME_RADIUS + wallThickness / 2;
      const wx = DOME_CENTER_X + Math.cos(angle) * r;
      const wy = DOME_CENTER_Y + Math.sin(angle) * r;

      this.matter.add.rectangle(wx, wy, wallThickness, segmentLength, {
        isStatic: true,
        angle,
        restitution: 1,
        friction: 0,
        label: 'dome:wall',
      });
    }

    this.statusText = this.add
      .text(DOME_CENTER_X, SCENE_HEIGHT - 22, 'Toca las letras en orden o empújalas dentro de la cúpula', {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);
  }

  private createWordSlots(): void {
    const challenge = this.activeChallenge;
    const tokens = challenge.tokens;

    if (challenge.mode === 'comprehension') {
      const passage = challenge.storyContext ?? '';
      const question = challenge.promptText ?? '';

      this.add
        .rectangle(DOME_CENTER_X, 42, 740, 68, 0x0f172a, 0.88)
        .setStrokeStyle(2, 0x38bdf8)
        .setDepth(5);
      this.add
        .text(DOME_CENTER_X, 26, passage, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '13px',
          color: '#e2e8f0',
          wordWrap: { width: 690 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.add
        .text(DOME_CENTER_X, 58, question, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#fef08a',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(6);

      const box = this.add
        .rectangle(DOME_CENTER_X, 94, 240, 34, 0x1e293b, 0.92)
        .setStrokeStyle(2.5, 0x475569)
        .setDepth(5);
      this.slotBoxes.push(box);
      this.slotPositions.push({ x: DOME_CENTER_X, y: 94 });
      return;
    }

    if (challenge.mode === 'sentence') {
      if (challenge.promptText) {
        this.add
          .text(DOME_CENTER_X, 20, challenge.promptText, {
            fontFamily: 'Lexend, system-ui, sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#fef08a',
          })
          .setOrigin(0.5)
          .setDepth(6);
      }

      const slotY = 64;
      const boxWidths = tokens.map((t) => Math.max(70, Math.min(132, t.length * 14 + 24)));
      const gap = 10;
      const totalWidth = boxWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, tokens.length - 1) * gap;
      let cursorX = DOME_CENTER_X - totalWidth / 2;

      tokens.forEach((token, idx) => {
        const w = boxWidths[idx] ?? 84;
        const sx = cursorX + w / 2;
        cursorX += w + gap;

        const box = this.add
          .rectangle(sx, slotY, w, 46, 0x1e293b, 0.9)
          .setStrokeStyle(2.5, 0x475569)
          .setDepth(5);
        this.slotBoxes.push(box);
        this.slotPositions.push({ x: sx, y: slotY });

        this.add
          .text(sx, slotY, token, {
            fontFamily: 'Lexend, system-ui, sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#334155',
          })
          .setOrigin(0.5)
          .setDepth(6);
      });
      return;
    }

    const spacing = 74;
    const startX = DOME_CENTER_X - ((tokens.length - 1) * spacing) / 2;

    tokens.forEach((token, idx) => {
      const sx = startX + idx * spacing;
      const box = this.add
        .rectangle(sx, SLOT_Y, 62, 62, 0x1e293b, 0.9)
        .setStrokeStyle(3, 0x475569)
        .setDepth(5);
      this.slotBoxes.push(box);
      this.slotPositions.push({ x: sx, y: SLOT_Y });

      // Guía tenue de la palabra objetivo para apoyo visual inicial
      this.add
        .text(sx, SLOT_Y, token, {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#334155',
        })
        .setOrigin(0.5)
        .setDepth(6);
    });
  }

  private createCreatureDisplay(): void {
    const texKey = `creature-${this.activeEntry.id}`;
    const colorNum = Phaser.Display.Color.HexStringToColor(this.activeEntry.creatureColor).color;
    const aura = this.add.circle(0, 0, 40, colorNum, 0.18).setStrokeStyle(2, colorNum, 0.55);

    const visual: Phaser.GameObjects.GameObject[] = [aura];
    if (this.textures.exists(texKey)) {
      const sprite = this.add.image(0, 0, texKey).setScale(0.24);
      visual.push(sprite);
    } else {
      const body = this.add.circle(0, 0, 26, colorNum, 0.95).setStrokeStyle(3, 0xfef9c3);
      const leftEye = this.add.circle(-8, -4, 3.5, 0x0f172a);
      const rightEye = this.add.circle(8, -4, 3.5, 0x0f172a);
      const smile = this.add.arc(0, 4, 8, 20, 160, false, 0x0f172a, 0).setStrokeStyle(2.5, 0x0f172a);
      visual.push(body, leftEye, rightEye, smile);
    }

    const label = this.add
      .text(0, 46, this.activeEntry.creatureName, {
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#0f172a99',
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5);
    visual.push(label);

    this.creatureBubble = this.add
      .container(DOME_CENTER_X, DOME_CENTER_Y - 120, visual)
      .setDepth(4);

    this.tweens.add({
      targets: this.creatureBubble,
      y: this.creatureBubble.y - 8,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createLetters(): void {
    const targetTokens = this.activeChallenge.tokens;
    const decoys =
      this.activeChallenge.decoys.length > 0
        ? this.activeChallenge.decoys
        : adaptiveEngine.selectDecoys(targetTokens);
    const allTokens = [...targetTokens, ...decoys];
    const spawnRadiusX = 142;
    const spawnRadiusY = 95;
    const shieldedSet = new Set(this.activeChallenge.shieldedTokens);

    // Distribuimos objetivo + señuelos en el arco superior de la cúpula, lejos del jugador
    allTokens.forEach((token, idx) => {
      const visualSlot = (idx + 1) % allTokens.length;
      const t = allTokens.length === 1 ? 0.5 : visualSlot / (allTokens.length - 1);
      const angle = Math.PI + 0.18 + t * (Math.PI - 0.36);
      const lx = DOME_CENTER_X + Math.cos(angle) * spawnRadiusX;
      const ly = DOME_CENTER_Y + Math.sin(angle) * spawnRadiusY + 25;

      const letter = new LetterBody(
        this,
        token,
        idx,
        lx,
        ly,
        this.physicsParams,
        (tapped) => {
          this.handleLetterHit(tapped, this.input.activePointer.x, this.input.activePointer.y);
        },
        { shielded: shieldedSet.has(token) }
      );
      this.letters.push(letter);
    });
  }

  private registerInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length === 0) {
        this.player?.setPointerTarget(pointer.x, pointer.y);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && this.player) {
        this.player.setPointerTarget(pointer.x, pointer.y);
      }
    });

    this.input.on('pointerup', () => {
      this.player?.clearPointerTarget();
    });
  }

  private registerCollisions(): void {
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      if (this.time.now < this.collisionGraceUntil) return;

      for (const pair of event.pairs) {
        const labelA = pair.bodyA.label ?? '';
        const labelB = pair.bodyB.label ?? '';

        const isPlayerA = labelA.startsWith('player:');
        const isPlayerB = labelB.startsWith('player:');
        const isLetterA = labelA.startsWith('letter:');
        const isLetterB = labelB.startsWith('letter:');

        if (isPlayerA && isLetterB) {
          const go = pair.bodyB.gameObject as Phaser.GameObjects.GameObject | undefined;
          const letter = go?.getData('letterInstance') as LetterBody | undefined;
          if (letter) {
            this.handleLetterHit(letter, pair.bodyA.position.x, pair.bodyA.position.y);
          }
        } else if (isPlayerB && isLetterA) {
          const go = pair.bodyA.gameObject as Phaser.GameObjects.GameObject | undefined;
          const letter = go?.getData('letterInstance') as LetterBody | undefined;
          if (letter) {
            this.handleLetterHit(letter, pair.bodyB.position.x, pair.bodyB.position.y);
          }
        }
      }
    });
  }

  private cleanupBusEvents(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  private registerBusEvents(): void {
    this.unsubscribers.push(
      gameBus.on('physics:update', (patch) => {
        if (!this.sys || !this.sys.isActive()) return;
        this.physicsParams = { ...this.physicsParams, ...patch };
        for (const letter of this.letters) {
          letter.applyPhysicsParams(this.physicsParams);
        }
        this.player?.applyPhysicsParams(this.physicsParams);
      }),
      gameBus.on('accessibility:update', (settings) => {
        if (!this.sys || !this.sys.isActive()) return;
        this.accessibility = { ...settings };
      }),
      gameBus.on('puzzle:reset', () => {
        if (!this.sys || !this.sys.isActive()) return;
        this.scene.restart({
          wordId: this.activeEntry.id,
          sentenceId: this.requestedSentenceId ?? undefined,
          mode: this.requestedMode ?? undefined,
        });
      })
    );
  }

  private handleLetterHit(letter: LetterBody, sourceX: number, sourceY: number): void {
    if (!letter.canTriggerHit(this.time.now)) return;

    speakText(letter.token);
    const result = this.tracker.evaluateHit(letter.token, {
      shieldIntact: letter.isShielded(),
    });
    if (result.ignored) return;

    if (result.shieldBroken) {
      letter.breakShield(sourceX, sourceY, this.physicsParams);
      playSoftBounce();
      this.statusText.setText(`¡Escudo roto en "${letter.token}"! Tócala de nuevo.`);
      return;
    }

    const adaptation = adaptiveEngine.recordHit(result.correct);
    gameBus.emit('progression:update', adaptation.snapshot);

    gameBus.emit('letter:hit', {
      token: letter.token,
      expected: result.expected,
      correct: result.correct,
      collectedIndex: result.collectedIndex,
    });

    if (result.correct) {
      const slotIndex = result.collectedIndex - 1;
      const slotPos = this.slotPositions[slotIndex];
      const slotBox = this.slotBoxes[slotIndex];

      playCorrectChime(slotIndex);
      if (slotBox) {
        slotBox.setStrokeStyle(3, 0x4ade80);
      }
      if (slotPos) {
        letter.collectToSlot(slotPos.x, slotPos.y);
      }

      // Quitar pistas activas tras acierto
      for (const item of this.letters) {
        item.setHintActive(false);
      }

      this.bounceCreature(1.18);
      this.statusText.setText(
        `¡Bien! ${this.activeChallenge.tokens.slice(0, result.collectedIndex).join(' ')}`
      );

      if (result.completed) {
        this.triggerCaptureCelebration();
      }
    } else {
      playSoftBounce();
      letter.playSoftReject(sourceX, sourceY, this.physicsParams);

      if (result.hintToken) {
        for (const item of this.letters) {
          item.setHintActive(!item.isCollected() && item.token === result.hintToken);
        }
        this.statusText.setText(`Pista: busca "${result.hintToken}"`);
        this.time.delayedCall(500, () => {
          speakText(result.hintToken ?? '');
        });
      } else {
        this.statusText.setText(`Esa es "${letter.token}". ¡Intentemos buscar "${result.expected}"!`);
      }
    }

    gameBus.emit('puzzle:state', this.tracker.getState());
  }

  private bounceCreature(peakScale: number): void {
    this.tweens.add({
      targets: this.creatureBubble,
      scale: { from: 1, to: peakScale },
      duration: 180,
      yoyo: true,
    });
  }

  private triggerCaptureCelebration(): void {
    playCaptureFanfare();
    this.bounceCreature(1.35);
    this.statusText.setText(
      `¡Completaste "${this.activeChallenge.speechText}" con ${this.activeChallenge.creatureName}!`
    );

    gameBus.emit('capture', {
      wordId: this.activeEntry.id,
      word: this.activeChallenge.displayTitle,
      creatureName: this.activeChallenge.creatureName,
    });

    this.time.delayedCall(420, () => {
      speakText(this.activeChallenge.speechText, { rate: 0.88 });
    });

    // Destellos de celebración simples (respetando movimiento reducido)
    if (this.accessibility.reducedMotion) return;
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const spark = this.add.circle(this.creatureBubble.x, this.creatureBubble.y, 6, 0xfacc15).setDepth(15);
      this.tweens.add({
        targets: spark,
        x: this.creatureBubble.x + Math.cos(angle) * 120,
        y: this.creatureBubble.y + Math.sin(angle) * 120,
        alpha: 0,
        scale: 0.2,
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }
}
