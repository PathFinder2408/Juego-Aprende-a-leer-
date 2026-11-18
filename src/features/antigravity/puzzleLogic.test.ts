import { describe, expect, it } from 'vitest';
import type { WordEntry } from '../../types/game';
import { PuzzleTracker } from './puzzleLogic';

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
});
