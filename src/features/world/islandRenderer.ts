import Phaser from 'phaser';
import type { WorldConfig } from '../../types/game';

export function ensureWorldTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('prop-ball')) {
    const tex = scene.textures.createCanvas('prop-ball', 56, 56);
    if (tex) {
      const ctx = tex.getContext();
      const c = 28;
      ctx.beginPath();
      ctx.arc(c, c, 25, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();

      // Franjas de pelota de playa
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, 25, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, 26, -0.5, 0.9);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, 26, 2.1, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(c, c, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(c, c, 25, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      tex.refresh();
    }
  }

  if (!scene.textures.exists('prop-coconut')) {
    const tex = scene.textures.createCanvas('prop-coconut', 38, 38);
    if (tex) {
      const ctx = tex.getContext();
      ctx.beginPath();
      ctx.arc(19, 19, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#92400e';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#451a03';
      ctx.stroke();

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(14, 14, 2.2, 0, Math.PI * 2);
      ctx.arc(21, 13, 2.2, 0, Math.PI * 2);
      ctx.arc(17, 19, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(13, 10, 5, 2.5, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();
      tex.refresh();
    }
  }

  if (!scene.textures.exists('prop-grass')) {
    const tex = scene.textures.createCanvas('prop-grass', 120, 76);
    if (tex) {
      const ctx = tex.getContext();
      const blades = [20, 34, 50, 66, 82, 98];
      blades.forEach((bx, idx) => {
        ctx.beginPath();
        ctx.moveTo(bx - 12, 66);
        ctx.quadraticCurveTo(bx - 4 + (idx % 2 === 0 ? -6 : 6), 24, bx + (idx % 2 === 0 ? -8 : 8), 10);
        ctx.quadraticCurveTo(bx + 6, 30, bx + 12, 66);
        ctx.closePath();
        ctx.fillStyle = idx % 2 === 0 ? '#16a34a' : '#22c55e';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#14532d';
        ctx.stroke();
      });
      tex.refresh();
    }
  }
}

export function renderIslandTerrain(scene: Phaser.Scene, world: WorldConfig): Phaser.GameObjects.Arc {
  const { width, height } = world;

  // Océano tropical profundo y arrecife turquesa
  scene.add.rectangle(width / 2, height / 2, width, height, 0x0284c7).setDepth(-50);
  scene.add
    .ellipse(width / 2, height / 2, width - 36, height - 36, 0x06b6d4, 0.55)
    .setDepth(-48);

  // Espuma animada de la orilla
  const foamRing = scene.add
    .ellipse(width / 2, height / 2, width - 92, height - 92, 0xe0f2fe, 0.7)
    .setDepth(-45);
  scene.tweens.add({
    targets: foamRing,
    scaleX: 1.015,
    scaleY: 1.02,
    alpha: 0.45,
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Playa de arena dorada
  scene.add
    .ellipse(width / 2, height / 2, width - 120, height - 120, 0xfde68a)
    .setStrokeStyle(6, 0xfcd34d)
    .setDepth(-40);

  // Pradera central estilo Alola
  scene.add
    .ellipse(width / 2 + 80, height / 2 - 10, width - 460, height - 340, 0x86efac)
    .setStrokeStyle(8, 0x4ade80)
    .setDepth(-35);

  // Sendero cálido desde el muelle hacia la pradera
  const path = scene.add.graphics().setDepth(-30);
  path.fillStyle(0xfef3c7, 0.9);
  path.fillRoundedRect(210, 505, 520, 68, 34);
  path.fillRoundedRect(660, 390, 74, 300, 34);

  // Muelle de madera al oeste
  const dock = scene.add.graphics().setDepth(-25);
  dock.fillStyle(0x78350f, 1);
  dock.fillRoundedRect(42, 492, 185, 92, 10);
  dock.fillStyle(0xb45309, 1);
  for (let px = 52; px < 218; px += 22) {
    dock.fillRoundedRect(px, 498, 16, 80, 4);
  }

  // Flores decorativas pequeñas para dar vida al terreno
  const flowerColors = [0xf472b6, 0xfacc15, 0xfb7185, 0xc084fc];
  for (let i = 0; i < 18; i += 1) {
    const fx = 420 + ((i * 173) % 760);
    const fy = 220 + ((i * 119) % 520);
    scene.add
      .circle(fx, fy, 5, flowerColors[i % flowerColors.length])
      .setStrokeStyle(1.5, 0xffffff)
      .setDepth(-20);
  }

  // Marcador de destino táctil (oculto hasta tocar la isla)
  const tapMarker = scene.add
    .circle(0, 0, 18, 0x38bdf8, 0.15)
    .setStrokeStyle(3, 0x38bdf8, 0.85)
    .setVisible(false)
    .setDepth(-10);

  return tapMarker;
}
