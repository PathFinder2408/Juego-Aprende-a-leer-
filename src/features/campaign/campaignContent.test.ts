import { describe, expect, it } from 'vitest';
import { ALL_MAZE_MAPS, getMazeMapById } from '../../data/maps';
import sentencesData from '../../data/sentences.json';
import wordsData from '../../data/words.json';
import type { SentenceEntry, WordEntry } from '../../types/game';
import { getBossById } from '../maze/bossBehavior';
import { validateMazeMap } from '../maze/mapValidator';
import { getAllChapters, getAllStages } from './campaignLogic';

const words = wordsData as WordEntry[];
const sentences = sentencesData as SentenceEntry[];

describe('Integridad integral de las 30 etapas de campaña (Capítulos 1–6)', () => {
  it('valida los 30 mapas en src/data/maps/ con alcanzabilidad BFS y dimensiones 15x11..23x15', () => {
    expect(ALL_MAZE_MAPS).toHaveLength(30);

    const mapIds = new Set<string>();
    for (const map of ALL_MAZE_MAPS) {
      expect(mapIds.has(map.id)).toBe(false);
      mapIds.add(map.id);

      const res = validateMazeMap(map, {
        minCols: 15,
        maxCols: 23,
        minRows: 11,
        maxRows: 15,
      });
      expect(res.errors, `Errores en ${map.id}`).toEqual([]);
      expect(res.valid).toBe(true);
    }
  });

  it('enlaza cada una de las 30 etapas con su mapa, palabras, frases y jefe válidos', () => {
    const chapters = getAllChapters();
    const stages = getAllStages();
    const wordIds = new Set(words.map((w) => w.id));
    const sentenceIds = new Set(sentences.map((s) => s.id));

    expect(chapters).toHaveLength(6);
    expect(stages).toHaveLength(30);

    for (const stage of stages) {
      const map = getMazeMapById(stage.mapId);
      expect(map, `Falta mapa ${stage.mapId} para ${stage.id}`).toBeDefined();

      expect(stage.wordIds.length).toBeGreaterThan(0);
      for (const wordId of stage.wordIds) {
        expect(wordIds.has(wordId), `Palabra faltante ${wordId} en ${stage.id}`).toBe(true);
      }

      for (const sentId of stage.sentenceIds) {
        expect(sentenceIds.has(sentId), `Frase faltante ${sentId} en ${stage.id}`).toBe(true);
      }

      if (stage.kind === 'boss') {
        expect(stage.bossId).toBeDefined();
        const boss = getBossById(stage.bossId ?? '');
        expect(boss, `Falta jefe ${stage.bossId} en ${stage.id}`).toBeDefined();
        expect(map?.bossSpawn).toBeDefined();
      }
    }
  });
});
