import Phaser from 'phaser';

const MOVE_SPEED = 4.4;

export class WorldPlayer {
  readonly sprite: Phaser.Physics.Matter.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null;
  private targetPoint: { x: number; y: number } | null = null;
  private walkTime = 0;
  private readonly baseScale = 0.28; // 320px -> ~90px de altura en mundo 2.5D

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'explorer') {
    this.shadow = scene.add.ellipse(x, y + 36, 46, 18, 0x0f172a, 0.32);

    const safeKey = scene.textures.exists(textureKey) ? textureKey : 'explorer';
    this.sprite = scene.matter.add.image(x, y, safeKey, undefined, {
      shape: { type: 'circle', radius: 22 },
      frictionAir: 0.18,
      friction: 0.05,
      restitution: 0.4,
      density: 0.004,
      label: 'world:player',
    });

    this.sprite.setScale(this.baseScale);
    this.sprite.setFixedRotation();

    this.cursors = scene.input.keyboard ? scene.input.keyboard.createCursorKeys() : null;
    this.wasd = scene.input.keyboard
      ? {
          up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        }
      : null;
  }

  setTextureKey(textureKey: string): void {
    const safeKey = this.sprite.scene.textures.exists(textureKey) ? textureKey : 'explorer';
    this.sprite.setTexture(safeKey);
  }

  setMoveTarget(x: number, y: number): void {
    this.targetPoint = { x, y };
  }

  clearMoveTarget(): void {
    this.targetPoint = null;
  }

  update(scene: Phaser.Scene, deltaMs: number): void {
    let vx = 0;
    let vy = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown) vx -= 1;
      if (this.cursors.right.isDown) vx += 1;
      if (this.cursors.up.isDown) vy -= 1;
      if (this.cursors.down.isDown) vy += 1;
    }

    if (this.wasd) {
      if (this.wasd.left.isDown) vx -= 1;
      if (this.wasd.right.isDown) vx += 1;
      if (this.wasd.up.isDown) vy -= 1;
      if (this.wasd.down.isDown) vy += 1;
    }

    const pad = scene.input.gamepad?.getPad(0);
    if (pad) {
      const ax = pad.leftStick.x;
      const ay = pad.leftStick.y;
      if (Math.hypot(ax, ay) > 0.2) {
        vx += ax;
        vy += ay;
      }
    }

    // Si hay entrada manual por teclado/gamepad, cancela objetivo táctil anterior
    if (Math.hypot(vx, vy) > 0.05) {
      this.targetPoint = null;
    } else if (this.targetPoint) {
      const dx = this.targetPoint.x - this.sprite.x;
      const dy = this.targetPoint.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 16) {
        vx = dx / dist;
        vy = dy / dist;
      } else {
        this.targetPoint = null;
      }
    }

    const mag = Math.hypot(vx, vy);
    if (mag > 0.01) {
      const nx = vx / mag;
      const ny = vy / mag;
      this.sprite.setVelocity(nx * MOVE_SPEED, ny * MOVE_SPEED);
      if (Math.abs(nx) > 0.1) {
        this.sprite.setFlipX(nx < 0);
      }

      // Animación torpe y simpática estilo Wobbly Life
      this.walkTime += (deltaMs / 1000) * 12;
      const waddle = Math.sin(this.walkTime) * 0.11;
      const squash = 1 + Math.sin(this.walkTime * 2) * 0.045;
      this.sprite.setRotation(waddle);
      this.sprite.setScale(this.baseScale * (2 - squash), this.baseScale * squash);
    } else {
      // Respiración suave en reposo
      this.walkTime += (deltaMs / 1000) * 2.5;
      const idleScale = 1 + Math.sin(this.walkTime) * 0.018;
      this.sprite.setRotation(0);
      this.sprite.setScale(this.baseScale, this.baseScale * idleScale);
    }

    this.shadow.setPosition(this.sprite.x, this.sprite.y + 38);
    this.shadow.setDepth(this.sprite.y - 1);
    this.sprite.setDepth(this.sprite.y);
  }
}
