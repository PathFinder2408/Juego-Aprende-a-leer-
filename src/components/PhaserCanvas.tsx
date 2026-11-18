import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import wordsData from '../data/words.json';
import { AntigravityScene } from '../features/antigravity/AntigravityScene';
import { WorldScene } from '../features/world/WorldScene';
import type { WordEntry } from '../types/game';

interface PhaserCanvasProps {
  screen: 'world' | 'antigravity';
  activeWordId: string;
}

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    if (!this.textures.exists('explorer')) {
      this.load.image('explorer', '/assets/explorer.png');
    }
    if (!this.textures.exists('palm-tree')) {
      this.load.image('palm-tree', '/assets/palm-tree.png');
    }
    for (const entry of wordsData as WordEntry[]) {
      if (entry.sprite) {
        const key = `creature-${entry.id}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, entry.sprite);
        }
      }
    }
  }

  create(): void {
    this.game.registry.set('bootDone', true);
    const targetScreen = (this.game.registry.get('targetScreen') as 'world' | 'antigravity') ?? 'world';
    const targetWordId = (this.game.registry.get('targetWordId') as string) ?? 'sol';

    if (targetScreen === 'world') {
      this.scene.start('WorldScene');
    } else {
      this.scene.start('AntigravityScene', { wordId: targetWordId });
    }
  }
}

export function PhaserCanvas({ screen, activeWordId }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 800,
      height: 600,
      backgroundColor: '#0f172a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: {
        gamepad: true,
      },
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, WorldScene, AntigravityScene],
    });

    game.registry.set('bootDone', false);
    game.registry.set('targetScreen', screen);
    game.registry.set('targetWordId', activeWordId);
    gameRef.current = game;

    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game || !game.registry) return;

    game.registry.set('targetScreen', screen);
    game.registry.set('targetWordId', activeWordId);

    if (game.registry.get('bootDone') !== true || !game.scene) return;

    if (screen === 'world') {
      if (game.scene.isActive('AntigravityScene')) {
        game.scene.stop('AntigravityScene');
      }
      if (!game.scene.isActive('WorldScene')) {
        game.scene.start('WorldScene');
      }
    } else {
      if (game.scene.isActive('WorldScene')) {
        game.scene.stop('WorldScene');
      }
      game.scene.start('AntigravityScene', { wordId: activeWordId });
    }
  }, [screen, activeWordId]);

  return <div ref={containerRef} className="phaser-mount" />;
}
