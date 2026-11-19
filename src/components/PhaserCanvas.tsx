import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import wordsData from '../data/words.json';
import { AntigravityScene } from '../features/antigravity/AntigravityScene';
import { MazeScene } from '../features/maze/MazeScene';
import { WorldScene } from '../features/world/WorldScene';
import type { DomeChallengeMode, WordEntry } from '../types/game';

export type PhaserScreen = 'world' | 'antigravity' | 'maze';

const DEFAULT_STAGE_WORD_IDS = ['sol'];
const DEFAULT_STAGE_SENTENCE_IDS: string[] = [];

interface PhaserCanvasProps {
  screen: PhaserScreen;
  activeWordId: string;
  activeSentenceId?: string;
  activeDomeMode?: DomeChallengeMode;
  activeMapId?: string;
  activeStageId?: string;
  activeStageTitle?: string;
  activeStageWordIds?: string[];
  activeStageSentenceIds?: string[];
  activeBossId?: string;
  equippedCardId?: string | null;
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
    const targetScreen = (this.game.registry.get('targetScreen') as PhaserScreen) ?? 'world';
    const targetWordId = (this.game.registry.get('targetWordId') as string) ?? 'sol';

    if (targetScreen === 'world') {
      this.scene.start('WorldScene');
    } else if (targetScreen === 'maze') {
      this.scene.start('MazeScene', {
        mapId: this.game.registry.get('targetMapId') as string | undefined,
        stageId: this.game.registry.get('targetStageId') as string | undefined,
        stageTitle: this.game.registry.get('targetStageTitle') as string | undefined,
        wordIds: this.game.registry.get('targetStageWordIds') as string[] | undefined,
        sentenceIds: this.game.registry.get('targetStageSentenceIds') as string[] | undefined,
        mode: this.game.registry.get('targetDomeMode') as DomeChallengeMode | undefined,
        bossId: this.game.registry.get('targetBossId') as string | undefined,
        equippedCardId: this.game.registry.get('targetEquippedCardId') as string | null | undefined,
      });
    } else {
      this.scene.start('AntigravityScene', {
        wordId: targetWordId,
        sentenceId: this.game.registry.get('targetSentenceId') as string | undefined,
        mode: this.game.registry.get('targetDomeMode') as DomeChallengeMode | undefined,
        equippedCardId: this.game.registry.get('targetEquippedCardId') as string | null | undefined,
      });
    }
  }
}

export function PhaserCanvas({
  screen,
  activeWordId,
  activeSentenceId,
  activeDomeMode = 'word',
  activeMapId = 'map-ch1-1',
  activeStageId = 'ch1-1',
  activeStageTitle = 'Playa Amanecer 1',
  activeStageWordIds = DEFAULT_STAGE_WORD_IDS,
  activeStageSentenceIds = DEFAULT_STAGE_SENTENCE_IDS,
  activeBossId,
  equippedCardId = null,
}: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const activeMazeKeyRef = useRef<string>('');

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
      scene: [BootScene, WorldScene, AntigravityScene, MazeScene],
    });

    game.registry.set('bootDone', false);
    game.registry.set('targetScreen', screen);
    game.registry.set('targetWordId', activeWordId);
    game.registry.set('targetSentenceId', activeSentenceId);
    game.registry.set('targetDomeMode', activeDomeMode);
    game.registry.set('targetMapId', activeMapId);
    game.registry.set('targetStageId', activeStageId);
    game.registry.set('targetStageTitle', activeStageTitle);
    game.registry.set('targetStageWordIds', activeStageWordIds);
    game.registry.set('targetStageSentenceIds', activeStageSentenceIds);
    game.registry.set('targetBossId', activeBossId);
    game.registry.set('targetEquippedCardId', equippedCardId);
    game.registry.set('targetEquippedCardId', equippedCardId);
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
    game.registry.set('targetSentenceId', activeSentenceId);
    game.registry.set('targetDomeMode', activeDomeMode);
    game.registry.set('targetMapId', activeMapId);
    game.registry.set('targetStageId', activeStageId);
    game.registry.set('targetStageTitle', activeStageTitle);
    game.registry.set('targetStageWordIds', activeStageWordIds);
    game.registry.set('targetStageSentenceIds', activeStageSentenceIds);
    game.registry.set('targetBossId', activeBossId);
    game.registry.set('targetEquippedCardId', equippedCardId);

    if (game.registry.get('bootDone') !== true || !game.scene) return;

    const stopOthers = (keepKey: string) => {
      for (const key of ['WorldScene', 'AntigravityScene', 'MazeScene']) {
        if (key !== keepKey && game.scene.isActive(key)) {
          game.scene.stop(key);
        }
      }
    };

    if (screen === 'world') {
      activeMazeKeyRef.current = '';
      stopOthers('WorldScene');
      if (!game.scene.isActive('WorldScene')) {
        game.scene.start('WorldScene');
      }
    } else if (screen === 'maze') {
      stopOthers('MazeScene');
      const mazeKey = `${activeMapId}|${activeStageId}|${activeBossId ?? ''}`;
      if (!game.scene.isActive('MazeScene') || activeMazeKeyRef.current !== mazeKey) {
        activeMazeKeyRef.current = mazeKey;
        game.scene.start('MazeScene', {
          mapId: activeMapId,
          stageId: activeStageId,
          stageTitle: activeStageTitle,
          wordIds: activeStageWordIds,
          sentenceIds: activeStageSentenceIds,
          mode: activeDomeMode,
          bossId: activeBossId,
          equippedCardId,
        });
      }
    } else {
      activeMazeKeyRef.current = '';
      stopOthers('AntigravityScene');
      game.scene.start('AntigravityScene', {
        wordId: activeWordId,
        sentenceId: activeSentenceId,
        mode: activeDomeMode,
        equippedCardId,
      });
    }
  }, [
    screen,
    activeWordId,
    activeSentenceId,
    activeDomeMode,
    activeMapId,
    activeStageId,
    activeStageTitle,
    activeStageWordIds,
    activeStageSentenceIds,
    activeBossId,
    equippedCardId,
  ]);

  return <div ref={containerRef} className="phaser-mount" />;
}
