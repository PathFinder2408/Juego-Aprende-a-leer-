import { describe, expect, it } from 'vitest';
import chaptersData from '../../data/chapters.json';
import sentencesData from '../../data/sentences.json';
import wordsData from '../../data/words.json';
import type { ChapterConfig, SentenceEntry, WordEntry } from '../../types/game';

const chapters = chaptersData as ChapterConfig[];
const words = wordsData as WordEntry[];
const sentences = sentencesData as SentenceEntry[];

describe('Currículo pedagógico v2.0 (JSON)', () => {
  it('define los 6 capítulos ordenados de 1 a 6 sin IDs duplicados', () => {
    expect(chapters.length).toBe(6);
    const ids = new Set<string>();

    chapters.forEach((chapter, idx) => {
      expect(chapter.order).toBe(idx + 1);
      expect(ids.has(chapter.id)).toBe(false);
      ids.add(chapter.id);
      expect(chapter.stageIds.length).toBeGreaterThanOrEqual(4);
      expect(chapter.bossId.length).toBeGreaterThan(0);
    });
  });

  it('asocia palabras válidas con tokens y criaturas originales a cada capítulo', () => {
    const chapterIds = new Set(chapters.map((c) => c.id));
    const wordIds = new Set<string>();

    for (const entry of words) {
      expect(wordIds.has(entry.id)).toBe(false);
      wordIds.add(entry.id);
      expect(entry.tokens.length).toBeGreaterThan(0);
      expect(entry.word.trim().length).toBeGreaterThan(0);
      expect(entry.creatureName.trim().length).toBeGreaterThan(0);
      expect(entry.chapterId).toBeDefined();
      expect(chapterIds.has(entry.chapterId ?? '')).toBe(true);
    }

    for (const chapter of chapters) {
      const chapterWords = words.filter((w) => w.chapterId === chapter.id);
      expect(chapterWords.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('incluye oraciones y comprensión lectora para fluidez sin tokens vacíos', () => {
    const chapterIds = new Set(chapters.map((c) => c.id));
    const sentenceIds = new Set<string>();

    for (const sentence of sentences) {
      expect(sentenceIds.has(sentence.id)).toBe(false);
      sentenceIds.add(sentence.id);
      expect(chapterIds.has(sentence.chapterId)).toBe(true);
      expect(sentence.tokens.length).toBeGreaterThan(0);
      expect(sentence.decoys.length).toBeGreaterThan(0);
      expect(sentence.speechText.trim().length).toBeGreaterThan(0);
      if (sentence.mode === 'comprehension') {
        expect(sentence.storyContext?.trim().length).toBeGreaterThan(10);
      }
    }

    const ch5And6 = sentences.filter((s) => s.chapterId === 'ch5' || s.chapterId === 'ch6');
    expect(ch5And6.some((s) => s.mode === 'sentence')).toBe(true);
    expect(ch5And6.some((s) => s.mode === 'comprehension')).toBe(true);
  });
});
