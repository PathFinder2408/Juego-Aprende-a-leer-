import type { PuzzleStatePayload, WordEntry } from '../../types/game';

export interface HitEvaluation {
  ignored: boolean;
  correct: boolean;
  expected: string;
  collectedIndex: number;
  completed: boolean;
  wrongStreak: number;
  hintToken: string | null;
}

const HINT_AFTER_ERRORS = 3;

export class PuzzleTracker {
  private readonly entry: WordEntry;
  private collectedIndex = 0;
  private wrongStreak = 0;

  constructor(entry: WordEntry) {
    this.entry = entry;
  }

  getState(): PuzzleStatePayload {
    const expected = this.entry.tokens[this.collectedIndex] ?? null;
    const hintToken = this.wrongStreak >= HINT_AFTER_ERRORS ? expected : null;
    return {
      word: this.entry.word,
      tokens: [...this.entry.tokens],
      collectedIndex: this.collectedIndex,
      wrongStreak: this.wrongStreak,
      hintToken,
    };
  }

  isCompleted(): boolean {
    return this.collectedIndex >= this.entry.tokens.length;
  }

  evaluateHit(token: string): HitEvaluation {
    if (this.isCompleted()) {
      return {
        ignored: true,
        correct: false,
        expected: '',
        collectedIndex: this.collectedIndex,
        completed: true,
        wrongStreak: this.wrongStreak,
        hintToken: null,
      };
    }

    const expected = this.entry.tokens[this.collectedIndex] ?? '';
    if (token === expected) {
      this.collectedIndex += 1;
      this.wrongStreak = 0;
      return {
        ignored: false,
        correct: true,
        expected,
        collectedIndex: this.collectedIndex,
        completed: this.isCompleted(),
        wrongStreak: 0,
        hintToken: null,
      };
    }

    this.wrongStreak += 1;
    const hintToken = this.wrongStreak >= HINT_AFTER_ERRORS ? expected : null;
    return {
      ignored: false,
      correct: false,
      expected,
      collectedIndex: this.collectedIndex,
      completed: false,
      wrongStreak: this.wrongStreak,
      hintToken,
    };
  }
}
