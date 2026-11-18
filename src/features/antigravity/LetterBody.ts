import Phaser from 'phaser';
import type { PhysicsParams } from '../../types/game';

const ORB_RADIUS = 40;
const MAX_READABLE_ANGLE = 0.42; // ~24 grados: legible siempre, pero con balanceo cómico

function createLetterTexture(scene: Phaser.Scene, key: string, token: string): void {
  if (scene.textures.exists(key)) return;

  const size = ORB_RADIUS * 2;
  const canvasTex = scene.textures.createCanvas(key, size, size);
  if (!canvasTex) return;

  const ctx = canvasTex.getContext();
  const cx = ORB_RADIUS;
  const cy = ORB_RADIUS;

  ctx.clearRect(0, 0, size, size);

  // Halo exterior 3D con degradado radial
  const outerGrad = ctx.createRadialGradient(cx - 10, cy - 12, 6, cx, cy, ORB_RADIUS - 2);
  outerGrad.addColorStop(0, '#bae6fd');
  outerGrad.addColorStop(0.65, '#38bdf8');
  outerGrad.addColorStop(1, '#0284c7');

  ctx.beginPath();
  ctx.arc(cx, cy, ORB_RADIUS - 2, 0, Math.PI * 2);
  ctx.fillStyle = outerGrad;
  ctx.fill();

  // Esfera interior cálida con sombreado 3D suave
  const innerGrad = ctx.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, ORB_RADIUS - 7);
  innerGrad.addColorStop(0, '#ffffff');
  innerGrad.addColorStop(0.7, '#fefce8');
  innerGrad.addColorStop(1, '#fde68a');

  ctx.beginPath();
  ctx.arc(cx, cy, ORB_RADIUS - 7, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Reflejo cristalino superior
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy - 17, 13, 6, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();

  // Texto en Lexend grande con sombra suave para máximo contraste
  const fontSize = token.length <= 2 ? 36 : 24;
  ctx.font = `800 ${fontSize}px Lexend, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.fillText(token, cx + 1.5, cy + 3.5);
  ctx.fillStyle = '#0f172a';
  ctx.fillText(token, cx, cy + 2);

  canvasTex.refresh();
}

export class LetterBody {
  readonly token: string;
  readonly sprite: Phaser.Physics.Matter.Image;
  private readonly scene: Phaser.Scene;
  private readonly hintRing: Phaser.GameObjects.Arc;
  private hintTween: Phaser.Tweens.Tween | null = null;
  private collected = false;
  private lastHitAt = 0;

  constructor(
    scene: Phaser.Scene,
    token: string,
    index: number,
    x: number,
    y: number,
    params: PhysicsParams,
    onTap: (letter: LetterBody) => void
  ) {
    this.scene = scene;
    this.token = token;

    const texKey = `letter-orb-${token}`;
    createLetterTexture(scene, texKey, token);

    this.sprite = scene.matter.add.image(x, y, texKey, undefined, {
      shape: { type: 'circle', radius: ORB_RADIUS },
      restitution: params.restitution,
      frictionAir: params.frictionAir,
      friction: 0.01,
      density: 0.002,
      label: `letter:${token}:${index}`,
    });

    this.sprite.setDepth(8);
    this.sprite.setData('letterInstance', this);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => {
      onTap(this);
    });

    // Impulso inicial suave para que empiece flotando
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const initialSpeed = Math.min(params.maxSpeed * 0.65, 2.0);
    this.sprite.setVelocity(Math.cos(angle) * initialSpeed, Math.sin(angle) * initialSpeed);

    // Aro de pista (oculto hasta que se active tras 3 errores seguidos)
    this.hintRing = scene.add.circle(x, y, ORB_RADIUS + 8);
    this.hintRing.setStrokeStyle(4, 0xfacc15, 0.95);
    this.hintRing.setFillStyle(0xfacc15, 0.14);
    this.hintRing.setVisible(false);
    this.hintRing.setDepth(7);
  }

  canTriggerHit(now: number, cooldownMs = 280): boolean {
    if (this.collected) return false;
    if (now - this.lastHitAt < cooldownMs) return false;
    this.lastHitAt = now;
    return true;
  }

  isCollected(): boolean {
    return this.collected;
  }

  applyPhysicsParams(params: PhysicsParams): void {
    if (this.collected || !this.sprite.active || !this.sprite.body) return;
    this.sprite.setBounce(params.restitution);
    this.sprite.setFrictionAir(params.frictionAir);
  }

  update(params: PhysicsParams): void {
    if (this.collected) return;

    const body = this.sprite.body as MatterJS.BodyType | undefined;
    if (!body) return;

    // Limitar velocidad máxima y dar un empujón sutil si queda casi quieta
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = Math.hypot(vx, vy);

    if (speed > params.maxSpeed) {
      const ratio = params.maxSpeed / speed;
      this.sprite.setVelocity(vx * ratio, vy * ratio);
    } else if (speed < 0.45) {
      const driftAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.sprite.applyForce(
        new Phaser.Math.Vector2(Math.cos(driftAngle) * 0.0008, Math.sin(driftAngle) * 0.0008)
      );
    }

    // Amortiguar giro y enderezar suavemente para mantener lectura clara
    const dampedAngular =
      body.angularVelocity * Math.max(0, 1 - params.angularDamping * 0.3) -
      this.sprite.rotation * params.uprightStiffness;
    this.sprite.setAngularVelocity(dampedAngular);

    if (Math.abs(this.sprite.rotation) > MAX_READABLE_ANGLE) {
      this.sprite.setRotation(
        Phaser.Math.Clamp(this.sprite.rotation, -MAX_READABLE_ANGLE, MAX_READABLE_ANGLE)
      );
      this.sprite.setAngularVelocity(0);
    }

    if (this.hintRing.visible) {
      this.hintRing.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  setHintActive(active: boolean): void {
    if (this.collected) active = false;
    if (active === this.hintRing.visible) return;

    this.hintRing.setVisible(active);
    if (active) {
      this.hintRing.setPosition(this.sprite.x, this.sprite.y);
      this.hintTween = this.scene.tweens.add({
        targets: this.hintRing,
        scale: { from: 0.95, to: 1.18 },
        alpha: { from: 0.95, to: 0.4 },
        duration: 550,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.hintTween?.stop();
      this.hintTween = null;
      this.hintRing.setScale(1);
      this.hintRing.setAlpha(1);
    }
  }

  playSoftReject(awayFromX: number, awayFromY: number, params: PhysicsParams): void {
    if (this.collected) return;

    const dx = this.sprite.x - awayFromX;
    const dy = this.sprite.y - awayFromY;
    const len = Math.hypot(dx, dy) || 1;
    const kick = Math.min(params.maxSpeed, 2.6);
    this.sprite.setVelocity((dx / len) * kick, (dy / len) * kick);

    this.sprite.setTint(0xfda4af);
    this.scene.time.delayedCall(260, () => {
      if (!this.collected && this.sprite.active) {
        this.sprite.clearTint();
      }
    });
  }

  collectToSlot(targetX: number, targetY: number): void {
    if (this.collected) return;
    this.collected = true;
    this.setHintActive(false);
    this.sprite.disableInteractive();
    this.sprite.clearTint();

    if (this.sprite.body) {
      this.sprite.setSensor(true);
      this.sprite.setCollisionCategory(0);
      this.sprite.setCollidesWith([]);
      this.sprite.setStatic(true);
      const bodyToRemove = this.sprite.body;
      this.scene.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
        if (this.scene.matter?.world && bodyToRemove) {
          this.scene.matter.world.remove(bodyToRemove);
        }
      });
    }

    this.sprite.setDepth(12);
    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      rotation: 0,
      scale: 0.72,
      duration: 420,
      ease: 'Back.easeOut',
    });
  }

  destroy(): void {
    this.hintTween?.stop();
    this.hintRing.destroy();
    this.sprite.destroy();
  }
}
