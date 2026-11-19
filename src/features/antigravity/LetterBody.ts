import Phaser from 'phaser';
import type { PhysicsParams } from '../../types/game';

const ORB_RADIUS = 40;
const MAX_READABLE_ANGLE = 0.42;

interface OrbDimensions {
  isPill: boolean;
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
}

function measureOrbDimensions(token: string): OrbDimensions {
  const trimmed = token.trim();
  if (trimmed.length <= 4) {
    return {
      isPill: false,
      width: ORB_RADIUS * 2,
      height: ORB_RADIUS * 2,
      lines: [trimmed],
      fontSize: trimmed.length <= 2 ? 36 : 24,
    };
  }

  let lines = [trimmed];
  if (trimmed.length > 13 && trimmed.includes(' ')) {
    const words = trimmed.split(' ');
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }

  const longest = Math.max(...lines.map((l) => l.length));
  const fontSize = longest > 11 ? 16 : 19;
  const width = Math.max(96, Math.min(204, longest * (fontSize * 0.68) + 34));
  const height = lines.length > 1 ? 68 : 54;

  return { isPill: true, width, height, lines, fontSize };
}

function drawPillPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function createLetterTexture(
  scene: Phaser.Scene,
  key: string,
  dims: OrbDimensions
): void {
  if (scene.textures.exists(key)) return;

  const canvasTex = scene.textures.createCanvas(key, dims.width, dims.height);
  if (!canvasTex) return;

  const ctx = canvasTex.getContext();
  const cx = dims.width / 2;
  const cy = dims.height / 2;

  ctx.clearRect(0, 0, dims.width, dims.height);

  if (!dims.isPill) {
    const outerGrad = ctx.createRadialGradient(cx - 10, cy - 12, 6, cx, cy, ORB_RADIUS - 2);
    outerGrad.addColorStop(0, '#bae6fd');
    outerGrad.addColorStop(0.65, '#38bdf8');
    outerGrad.addColorStop(1, '#0284c7');

    ctx.beginPath();
    ctx.arc(cx, cy, ORB_RADIUS - 2, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    const innerGrad = ctx.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, ORB_RADIUS - 7);
    innerGrad.addColorStop(0, '#ffffff');
    innerGrad.addColorStop(0.7, '#fefce8');
    innerGrad.addColorStop(1, '#fde68a');

    ctx.beginPath();
    ctx.arc(cx, cy, ORB_RADIUS - 7, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - 11, cy - 17, 13, 6, -0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
  } else {
    const outerGrad = ctx.createLinearGradient(0, 0, 0, dims.height);
    outerGrad.addColorStop(0, '#bae6fd');
    outerGrad.addColorStop(0.55, '#38bdf8');
    outerGrad.addColorStop(1, '#0284c7');
    drawPillPath(ctx, 2, 2, dims.width - 4, dims.height - 4, 24);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    const innerGrad = ctx.createLinearGradient(0, 6, 0, dims.height - 6);
    innerGrad.addColorStop(0, '#ffffff');
    innerGrad.addColorStop(0.75, '#fefce8');
    innerGrad.addColorStop(1, '#fde68a');
    drawPillPath(ctx, 7, 6, dims.width - 14, dims.height - 12, 20);
    ctx.fillStyle = innerGrad;
    ctx.fill();
  }

  ctx.font = `800 ${dims.fontSize}px Lexend, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineStep = dims.fontSize + 3;
  const startY = cy - ((dims.lines.length - 1) * lineStep) / 2 + 1;
  dims.lines.forEach((line, idx) => {
    const ly = startY + idx * lineStep;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillText(line, cx + 1.2, ly + 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(line, cx, ly);
  });

  canvasTex.refresh();
}

export class LetterBody {
  readonly token: string;
  readonly sprite: Phaser.Physics.Matter.Image;
  private readonly scene: Phaser.Scene;
  private readonly hintRing: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  private readonly shieldVisual: Phaser.GameObjects.Container | null = null;
  private hintTween: Phaser.Tweens.Tween | null = null;
  private collected = false;
  private shielded: boolean;
  private lastHitAt = 0;

  constructor(
    scene: Phaser.Scene,
    token: string,
    index: number,
    x: number,
    y: number,
    params: PhysicsParams,
    onTap: (letter: LetterBody) => void,
    options?: { shielded?: boolean }
  ) {
    this.scene = scene;
    this.token = token;
    this.shielded = Boolean(options?.shielded);

    const dims = measureOrbDimensions(token);
    const texKey = `letter-orb-${dims.isPill ? 'pill' : 'orb'}-${token}`;
    createLetterTexture(scene, texKey, dims);

    const shapeConfig: Phaser.Types.Physics.Matter.MatterSetBodyConfig = dims.isPill
      ? {
          type: 'rectangle',
          width: dims.width,
          height: dims.height,
        }
      : {
          type: 'circle',
          radius: ORB_RADIUS,
        };

    this.sprite = scene.matter.add.image(x, y, texKey, undefined, {
      shape: shapeConfig,
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

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const initialSpeed = Math.min(params.maxSpeed * 0.65, 2.0);
    this.sprite.setVelocity(Math.cos(angle) * initialSpeed, Math.sin(angle) * initialSpeed);

    if (dims.isPill) {
      this.hintRing = scene.add
        .rectangle(x, y, dims.width + 14, dims.height + 14, 0xfacc15, 0.14)
        .setStrokeStyle(4, 0xfacc15, 0.95);
    } else {
      this.hintRing = scene.add
        .circle(x, y, ORB_RADIUS + 8, 0xfacc15, 0.14)
        .setStrokeStyle(4, 0xfacc15, 0.95);
    }
    this.hintRing.setVisible(false);
    this.hintRing.setDepth(7);

    if (this.shielded) {
      const armor = dims.isPill
        ? scene.add
            .rectangle(0, 0, dims.width + 12, dims.height + 12, 0x38bdf8, 0.18)
            .setStrokeStyle(3.5, 0x22d3ee, 0.95)
        : scene.add
            .circle(0, 0, ORB_RADIUS + 7, 0x38bdf8, 0.18)
            .setStrokeStyle(3.5, 0x22d3ee, 0.95);
      const badge = scene.add
        .text(dims.width / 2 - 4, -dims.height / 2 + 2, '🛡', {
          fontFamily: 'Lexend, system-ui, sans-serif',
          fontSize: '15px',
        })
        .setOrigin(0.5);
      this.shieldVisual = scene.add.container(x, y, [armor, badge]).setDepth(9);
    }
  }

  isShielded(): boolean {
    return this.shielded;
  }

  breakShield(awayFromX: number, awayFromY: number, params: PhysicsParams): void {
    if (!this.shielded) return;
    this.shielded = false;
    if (this.shieldVisual) {
      this.shieldVisual.setVisible(false);
    }

    const dx = this.sprite.x - awayFromX;
    const dy = this.sprite.y - awayFromY;
    const len = Math.hypot(dx, dy) || 1;
    const kick = Math.min(params.maxSpeed, 2.2);
    this.sprite.setVelocity((dx / len) * kick, (dy / len) * kick);
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
      this.hintRing.setRotation(this.sprite.rotation);
    }

    if (this.shieldVisual && this.shieldVisual.visible) {
      this.shieldVisual.setPosition(this.sprite.x, this.sprite.y);
      this.shieldVisual.setRotation(this.sprite.rotation);
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
        scale: { from: 0.95, to: 1.14 },
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
    this.shielded = false;
    this.setHintActive(false);
    this.shieldVisual?.setVisible(false);
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
      scale: 0.68,
      duration: 420,
      ease: 'Back.easeOut',
    });
  }

  destroy(): void {
    this.hintTween?.stop();
    this.hintRing.destroy();
    this.shieldVisual?.destroy();
    this.sprite.destroy();
  }
}
