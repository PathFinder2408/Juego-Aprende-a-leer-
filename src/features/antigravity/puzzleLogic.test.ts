import { describe, expect, it } from 'vitest';
import type { SentenceEntry, WordEntry } from '../../types/game';
import {
  PuzzleTracker,
  challengeFromSentence,
} from './puzzleLogic';

const SOL_ENTRY: WordEntry = {
  id: 'sol',
  word: 'SOL',
  tokens: ['S', 'O', 'L'],
  level: 1,
  creatureName: 'Solín',
  creatureColor: '#facc15',
};

const LUNA_ENTRY: WordEntry = {
  id: 'luna',
  word: 'LUNA',
  tokens: ['LU', 'NA'],
  level: 2,
  creatureName: 'Mumu',
  creatureColor: '#a5b4fc',
};

const SENTENCE_ENTRY: SentenceEntry = {
  id: 'sent-ch4-1',
  chapterId: 'ch4',
  level: 4,
  mode: 'sentence',
  promptText: 'Arma la oración de la brújula',
  tokens: ['LA', 'BRÚJULA', 'GUÍA', 'EL', 'TREN'],
  decoys: ['GLOBO', 'SOPA'],
  speechText: 'La brújula guía el tren.',
  shieldedTokens: ['BRÚJULA'],
};

const COMPREHENSION_ENTRY: SentenceEntry = {
  id: 'comp-ch5-1',
  chapterId: 'ch5',
  level: 5,
  mode: 'comprehension',
  storyContext: 'Sapín cruzó el puente de madera para buscar moras dulces.',
  promptText: '¿Qué cruzó Sapín?',
  tokens: ['EL PUENTE'],
  decoys: ['EL VOLCÁN', 'LA NUBE'],
  speechText: 'Sapín cruzó el puente.',
};

describe('PuzzleTracker', () => {
  it('completa S-O-L en orden correcto', () => {
    const tracker = new PuzzleTracker(SOL_ENTRY);

    const r1 = tracker.evaluateHit('S');
    expect(r1.correct).toBe(true);
    expect(r1.completed).toBe(false);
    expect(r1.collectedIndex).toBe(1);

    const r2 = tracker.evaluateHit('O');
    expect(r2.correct).toBe(true);
    expect(r2.completed).toBe(false);

    const r3 = tracker.evaluateHit('L');
    expect(r3.correct).toBe(true);
    expect(r3.completed).toBe(true);
    expect(tracker.isCompleted()).toBe(true);
  });

  it('no reinicia el progreso al fallar y activa pista tras 3 errores seguidos', () => {
    const tracker = new PuzzleTracker(SOL_ENTRY);
    tracker.evaluateHit('S');

    const w1 = tracker.evaluateHit('L');
    expect(w1.correct).toBe(false);
    expect(w1.collectedIndex).toBe(1);
    expect(w1.hintToken).toBeNull();

    const w2 = tracker.evaluateHit('L');
    expect(w2.hintToken).toBeNull();

    const w3 = tracker.evaluateHit('L');
    expect(w3.wrongStreak).toBe(3);
    expect(w3.hintToken).toBe('O');
    expect(w3.collectedIndex).toBe(1);

    const ok = tracker.evaluateHit('O');
    expect(ok.correct).toBe(true);
    expect(ok.wrongStreak).toBe(0);
    expect(ok.hintToken).toBeNull();
  });

  it('valida palabras por sílabas directas como LU-NA e ignora toques tras completar', () => {
    const tracker = new PuzzleTracker(LUNA_ENTRY);
    expect(tracker.evaluateHit('NA').correct).toBe(false);
    expect(tracker.evaluateHit('LU').correct).toBe(true);
    expect(tracker.evaluateHit('NA').completed).toBe(true);
    expect(tracker.evaluateHit('LU').ignored).toBe(true);
  });

  it('valida modo sentence y rompe burbujas con escudo sin sumar errores', () => {
    const challenge = challengeFromSentence(SENTENCE_ENTRY);
    const tracker = new PuzzleTracker(challenge);

    expect(tracker.evaluateHit('LA').correct).toBe(true);
    expect(tracker.hasActiveShield('BRÚJULA')).toBe(true);

    // Primer golpe en token con escudo rompe el escudo sin incrementar wrongStreak
    const shieldHit = tracker.evaluateHit('BRÚJULA');
    expect(shieldHit.shieldBroken).toBe(true);
    expect(shieldHit.correct).toBe(false);
    expect(shieldHit.wrongStreak).toBe(0);
    expect(tracker.hasActiveShield('BRÚJULA')).toBe(false);

    // Segundo golpe recoge la palabra
    expect(tracker.evaluateHit('BRÚJULA').correct).toBe(true);
    expect(tracker.evaluateHit('GUÍA').correct).toBe(true);
    expect(tracker.evaluateHit('EL').correct).toBe(true);

    const finalHit = tracker.evaluateHit('TREN');
    expect(finalHit.completed).toBe(true);
    expect(tracker.getChallenge().speechText).toBe('La brújula guía el tren.');
    expect(tracker.getStats().accuracyPercent).toBe(100);
  });

  it('valida modo comprehension rechazando distractores y midiendo precisión', () => {
    const challenge = challengeFromSentence(COMPREHENSION_ENTRY, LUNA_ENTRY);
    const tracker = new PuzzleTracker(challenge);

    const wrong = tracker.evaluateHit('EL VOLCÁN');
    expect(wrong.correct).toBe(false);
    expect(wrong.completed).toBe(false);

    const ok = tracker.evaluateHit('EL PUENTE');
    expect(ok.correct).toBe(true);
    expect(ok.completed).toBe(true);
    expect(tracker.getStats().accuracyPercent).toBe(50);
  });
});
