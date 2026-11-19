import Phaser from 'phaser';
import type { MazePlayerState } from './mazeEngine';

const BASE_SCALE = 0.175; // 320px -> ~56px para calzar limpio en grilla 56px

/**
 * Representación visual 2.5D del explorador dentro de `MazeScene`.
 */
export class MazePlayer {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly tileSize: number;
  private walkTime = 0;
  private prevX: number;
  private prevY: number;
  private dropPulse = 0;

  constructor(scene: Phaser.Scene, initial: MazePlayerState, tileSize: number) {
    this.tileSize = tileSize;
    this.prevX = initial.x;
    this.prevY = initial.y;

    const px = this.toPixel(initial.x);
    const py = this.toPixel(initial.y);

    this.shadow = scene.add.ellipse(px, py + 18, 34, 14, 0x0f172a, 0.34);
    this.sprite = scene.add.image(px, py - 4, 'explorer');
    this.sprite.setScale(BASE_SCALE);
    this.updateDepth(py);
  }

  playBubbleDropBounce(): void {
    this.dropPulse = 1;
  }

  playWarpFlash(scene: Phaser.Scene, reducedMotion: boolean): void {
    if (reducedMotion) return;
    scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.35, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  sync(state: MazePlayerState, deltaMs: number, reducedMotion: boolean): void {
    const px = this.toPixel(state.x);
    const py = this.toPixel(state.y);
    const moved = Math.hypot(state.x - this.prevX, state.y - this.prevY) > 0.002;

    this.prevX = state.x;
    this.prevY = state.y;

    if (state.facing === 'left') {
      this.sprite.setFlipX(true);
    } else if (state.facing === 'right') {
      this.sprite.setFlipX(false);
    }

    let bobY = 0;
    let rot = 0;
    let scaleX = BASE_SCALE;
    let scaleY = BASE_SCALE;

    if (!reducedMotion) {
      if (moved) {
        this.walkTime += (deltaMs / 1000) * 14;
        rot = Math.sin(this.walkTime) * 0.1;
        const squash = 1 + Math.sin(this.walkTime * 2) * 0.055;
        scaleX = BASE_SCALE * (2 - squash);
        scaleY = BASE_SCALE * squash;
        bobY = -Math.abs(Math.sin(this.walkTime)) * 3;
      } else {
        this.walkTime += (deltaMs / 1000) * 2.6;
        const idle = 1 + Math.sin(this.walkTime) * 0.02;
        scaleY = BASE_SCALE * idle;
      }

      if (this.dropPulse > 0) {
        this.dropPulse = Math.max(0, this.dropPulse - deltaMs / 180);
        const bump = Math.sin(this.dropPulse * Math.PI) * 0.14;
        scaleX += BASE_SCALE * bump;
        scaleY -= BASE_SCALE * bump * 0.6;
      }
    } else {
      this.dropPulse = 0;
    }

    this.sprite.setPosition(px, py - 5 + bobY);
    this.sprite.setRotation(rot);
    this.sprite.setScale(scaleX, scaleY);

    this.shadow.setPosition(px, py + 17);
    this.updateDepth(py);
  }

  private toPixel(tileCoord: number): number {
    return (tileCoord + 0.5) * this.tileSize;
  }

  private updateDepth(pixelY: number): void {
    this.shadow.setDepth(pixelY - 1);
    this.sprite.setDepth(pixelY + 6);
  }
}
