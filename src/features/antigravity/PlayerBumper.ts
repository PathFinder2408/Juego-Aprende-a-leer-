import Phaser from 'phaser';
import type { PhysicsParams } from '../../types/game';

const TORSO_RADIUS = 24;
const HEAD_RADIUS = 17;
const PLAYER_COLLISION_GROUP = -1;

function ensurePlayerTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('player-torso')) {
    const s = TORSO_RADIUS * 2;
    const tex = scene.textures.createCanvas('player-torso', s, s);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(TORSO_RADIUS - 6, TORSO_RADIUS - 7, 3, TORSO_RADIUS, TORSO_RADIUS, TORSO_RADIUS - 2);
      grad.addColorStop(0, '#5eead4');
      grad.addColorStop(0.65, '#14b8a6');
      grad.addColorStop(1, '#0f766e');

      ctx.beginPath();
      ctx.arc(TORSO_RADIUS, TORSO_RADIUS, TORSO_RADIUS - 2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#134e4a';
      ctx.stroke();

      // Insignia estrella dorada
      ctx.beginPath();
      ctx.arc(TORSO_RADIUS, TORSO_RADIUS, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      tex.refresh();
    }
  }

  if (!scene.textures.exists('player-head')) {
    const s = HEAD_RADIUS * 2;
    const tex = scene.textures.createCanvas('player-head', s, s);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(HEAD_RADIUS - 4, HEAD_RADIUS - 6, 2, HEAD_RADIUS, HEAD_RADIUS, HEAD_RADIUS - 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.75, '#e2e8f0');
      grad.addColorStop(1, '#94a3b8');

      ctx.beginPath();
      ctx.arc(HEAD_RADIUS, HEAD_RADIUS, HEAD_RADIUS - 2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Visor 3D brillante
      ctx.beginPath();
      ctx.ellipse(HEAD_RADIUS, HEAD_RADIUS + 1, 10, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Ojos amigables
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.arc(HEAD_RADIUS - 4, HEAD_RADIUS, 2.3, 0, Math.PI * 2);
      ctx.arc(HEAD_RADIUS + 4, HEAD_RADIUS, 2.3, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
    }
  }
}

export class PlayerBumper {
  readonly torso: Phaser.Physics.Matter.Image;
  readonly head: Phaser.Physics.Matter.Image;
  private readonly limbsGraphics: Phaser.GameObjects.Graphics;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null;
  private pointerTarget: { x: number; y: number } | null = null;
  private wobbleTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, params: PhysicsParams) {
    ensurePlayerTextures(scene);

    this.limbsGraphics = scene.add.graphics().setDepth(4);

    // Ragdoll simplificado: torso + cabeza unidos por constraint elástico
    this.torso = scene.matter.add.image(x, y, 'player-torso', undefined, {
      shape: { type: 'circle', radius: TORSO_RADIUS },
      restitution: params.restitution,
      frictionAir: params.frictionAir + 0.025,
      friction: 0.02,
      density: 0.003,
      collisionFilter: { group: PLAYER_COLLISION_GROUP },
      label: 'player:torso',
    });
    this.torso.setDepth(5);

    this.head = scene.matter.add.image(x, y - 34, 'player-head', undefined, {
      shape: { type: 'circle', radius: HEAD_RADIUS },
      restitution: params.restitution,
      frictionAir: params.frictionAir + 0.02,
      friction: 0.02,
      density: 0.0015,
      collisionFilter: { group: PLAYER_COLLISION_GROUP },
      label: 'player:head',
    });
    this.head.setDepth(6);

    const torsoBody = this.torso.body as MatterJS.BodyType;
    const headBody = this.head.body as MatterJS.BodyType;
    scene.matter.add.constraint(torsoBody, headBody, 34, 0.25);

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

  getPosition(): { x: number; y: number } {
    return { x: this.torso.x, y: this.torso.y };
  }

  setPointerTarget(x: number, y: number): void {
    this.pointerTarget = { x, y };
  }

  clearPointerTarget(): void {
    this.pointerTarget = null;
  }

  applyPhysicsParams(params: PhysicsParams): void {
    if (!this.torso.active || !this.torso.body || !this.head.active || !this.head.body) return;
    this.torso.setBounce(params.restitution);
    this.head.setBounce(params.restitution);
    this.torso.setFrictionAir(params.frictionAir + 0.025);
    this.head.setFrictionAir(params.frictionAir + 0.02);
  }

  update(scene: Phaser.Scene, deltaMs: number, params: PhysicsParams): void {
    let dirX = 0;
    let dirY = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown) dirX -= 1;
      if (this.cursors.right.isDown) dirX += 1;
      if (this.cursors.up.isDown) dirY -= 1;
      if (this.cursors.down.isDown) dirY += 1;
    }

    if (this.wasd) {
      if (this.wasd.left.isDown) dirX -= 1;
      if (this.wasd.right.isDown) dirX += 1;
      if (this.wasd.up.isDown) dirY -= 1;
      if (this.wasd.down.isDown) dirY += 1;
    }

    // Soporte Gamepad opcional (stick izquierdo)
    const pad = scene.input.gamepad?.getPad(0);
    if (pad) {
      const ax = pad.leftStick.x;
      const ay = pad.leftStick.y;
      if (Math.hypot(ax, ay) > 0.2) {
        dirX += ax;
        dirY += ay;
      }
    }

    // Arrastre táctil / puntero hacia donde apunta el niño
    if (this.pointerTarget) {
      const dx = this.pointerTarget.x - this.torso.x;
      const dy = this.pointerTarget.y - this.torso.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) {
        dirX += dx / dist;
        dirY += dy / dist;
      }
    }

    const mag = Math.hypot(dirX, dirY);
    if (mag > 0.01) {
      const nx = dirX / mag;
      const ny = dirY / mag;
      this.torso.applyForce(new Phaser.Math.Vector2(nx * params.impulseForce, ny * params.impulseForce));
    }

    const torsoBody = this.torso.body as MatterJS.BodyType | undefined;
    const headBody = this.head.body as MatterJS.BodyType | undefined;

    if (torsoBody) {
      const maxPlayerSpeed = params.maxSpeed * 1.45;
      const speed = Math.hypot(torsoBody.velocity.x, torsoBody.velocity.y);
      if (speed > maxPlayerSpeed) {
        const r = maxPlayerSpeed / speed;
        this.torso.setVelocity(torsoBody.velocity.x * r, torsoBody.velocity.y * r);
      }
      this.torso.setAngularVelocity(torsoBody.angularVelocity * 0.85 - this.torso.rotation * 0.08);
    }

    if (headBody) {
      this.head.setAngularVelocity(headBody.angularVelocity * 0.85 - this.head.rotation * 0.1);
    }

    this.drawProceduralLimbs(deltaMs, torsoBody);
  }

  private drawProceduralLimbs(deltaMs: number, torsoBody: MatterJS.BodyType | undefined): void {
    const speed = torsoBody ? Math.hypot(torsoBody.velocity.x, torsoBody.velocity.y) : 0;
    this.wobbleTime += (deltaMs / 1000) * (3.5 + speed * 2.2);

    const g = this.limbsGraphics;
    g.clear();
    g.lineStyle(7, 0x0d9488, 1);

    const cx = this.torso.x;
    const cy = this.torso.y;
    const rot = this.torso.rotation;
    const armSwing = Math.sin(this.wobbleTime) * 10;
    const legSwing = Math.cos(this.wobbleTime * 1.1) * 9;

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const toWorld = (lx: number, ly: number) => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    });

    // Brazos torpes y simpáticos
    const lShoulder = toWorld(-18, -4);
    const lHand = toWorld(-34, -10 + armSwing);
    const rShoulder = toWorld(18, -4);
    const rHand = toWorld(34, -10 - armSwing);

    // Piernas flotantes
    const lHip = toWorld(-10, 18);
    const lFoot = toWorld(-15 + legSwing * 0.5, 36 + legSwing * 0.4);
    const rHip = toWorld(10, 18);
    const rFoot = toWorld(15 - legSwing * 0.5, 36 - legSwing * 0.4);

    g.lineBetween(lShoulder.x, lShoulder.y, lHand.x, lHand.y);
    g.lineBetween(rShoulder.x, rShoulder.y, rHand.x, rHand.y);
    g.lineBetween(lHip.x, lHip.y, lFoot.x, lFoot.y);
    g.lineBetween(rHip.x, rHip.y, rFoot.x, rFoot.y);
  }

  destroy(): void {
    this.limbsGraphics.destroy();
    this.torso.destroy();
    this.head.destroy();
  }
}
