import type {
  DomeChallengeMode,
  PuzzleStatePayload,
  SentenceEntry,
  WordEntry,
} from '../../types/game';

export interface DomeChallenge {
  id: string;
  wordId: string;
  mode: DomeChallengeMode;
  displayTitle: string;
  tokens: string[];
  decoys: string[];
  speechText: string;
  promptText?: string;
  storyContext?: string;
  shieldedTokens: string[];
  creatureName: string;
  creatureColor: string;
}

export interface HitEvaluation {
  ignored: boolean;
  shieldBroken: boolean;
  correct: boolean;
  expected: string;
  collectedIndex: number;
  completed: boolean;
  wrongStreak: number;
  hintToken: string | null;
}

export interface PuzzleStats {
  totalHits: number;
  wrongHits: number;
  accuracyPercent: number;
}

const HINT_AFTER_ERRORS = 3;

export function challengeFromWord(entry: WordEntry): DomeChallenge {
  return {
    id: entry.id,
    wordId: entry.id,
    mode: 'word',
    displayTitle: entry.word,
    tokens: [...entry.tokens],
    decoys: [],
    speechText: entry.word,
    shieldedTokens: [],
    creatureName: entry.creatureName,
    creatureColor: entry.creatureColor,
  };
}

export function challengeFromSentence(
  sentence: SentenceEntry,
  linkedWord?: WordEntry
): DomeChallenge {
  return {
    id: sentence.id,
    wordId: linkedWord?.id ?? sentence.id,
    mode: sentence.mode,
    displayTitle: sentence.speechText,
    tokens: [...sentence.tokens],
    decoys: [...sentence.decoys],
    speechText: sentence.speechText,
    promptText: sentence.promptText,
    storyContext: sentence.storyContext,
    shieldedTokens: [...(sentence.shieldedTokens ?? [])],
    creatureName: linkedWord?.creatureName ?? 'Guardián del Saber',
    creatureColor: linkedWord?.creatureColor ?? '#38bdf8',
  };
}

function isWordEntry(input: WordEntry | DomeChallenge): input is WordEntry {
  return 'word' in input && !('mode' in input);
}

export class PuzzleTracker {
  private readonly challenge: DomeChallenge;
  private readonly activeShields: Set<string>;
  private collectedIndex = 0;
  private wrongStreak = 0;
  private totalHits = 0;
  private wrongHits = 0;

  constructor(entryOrChallenge: WordEntry | DomeChallenge) {
    this.challenge = isWordEntry(entryOrChallenge)
      ? challengeFromWord(entryOrChallenge)
      : entryOrChallenge;
    this.activeShields = new Set(this.challenge.shieldedTokens);
  }

  getChallenge(): DomeChallenge {
    return this.challenge;
  }

  hasActiveShield(token: string): boolean {
    return this.activeShields.has(token);
  }

  getStats(): PuzzleStats {
    if (this.totalHits === 0) {
      return { totalHits: 0, wrongHits: 0, accuracyPercent: 100 };
    }
    const accuracyPercent = Math.round(
      ((this.totalHits - this.wrongHits) / this.totalHits) * 100
    );
    return {
      totalHits: this.totalHits,
      wrongHits: this.wrongHits,
      accuracyPercent: Math.max(0, Math.min(100, accuracyPercent)),
    };
  }

  getState(): PuzzleStatePayload {
    const expected = this.challenge.tokens[this.collectedIndex] ?? null;
    const hintToken = this.wrongStreak >= HINT_AFTER_ERRORS ? expected : null;
    return {
      word: this.challenge.displayTitle,
      tokens: [...this.challenge.tokens],
      collectedIndex: this.collectedIndex,
      wrongStreak: this.wrongStreak,
      hintToken,
    };
  }

  isCompleted(): boolean {
    return this.collectedIndex >= this.challenge.tokens.length;
  }

  evaluateHit(token: string, options?: { shieldIntact?: boolean }): HitEvaluation {
    if (this.isCompleted()) {
      return {
        ignored: true,
        shieldBroken: false,
        correct: false,
        expected: '',
        collectedIndex: this.collectedIndex,
        completed: true,
        wrongStreak: this.wrongStreak,
        hintToken: null,
      };
    }

    const expected = this.challenge.tokens[this.collectedIndex] ?? '';
    const hasShield = options?.shieldIntact ?? this.activeShields.has(token);

    if (hasShield) {
      this.activeShields.delete(token);
      const hintToken = this.wrongStreak >= HINT_AFTER_ERRORS ? expected : null;
      return {
        ignored: false,
        shieldBroken: true,
        correct: false,
        expected,
        collectedIndex: this.collectedIndex,
        completed: false,
        wrongStreak: this.wrongStreak,
        hintToken,
      };
    }

    this.totalHits += 1;

    if (token === expected) {
      this.collectedIndex += 1;
      this.wrongStreak = 0;
      return {
        ignored: false,
        shieldBroken: false,
        correct: true,
        expected,
        collectedIndex: this.collectedIndex,
        completed: this.isCompleted(),
        wrongStreak: 0,
        hintToken: null,
      };
    }

    this.wrongStreak += 1;
    this.wrongHits += 1;
    const hintToken = this.wrongStreak >= HINT_AFTER_ERRORS ? expected : null;
    return {
      ignored: false,
      shieldBroken: false,
      correct: false,
      expected,
      collectedIndex: this.collectedIndex,
      completed: false,
      wrongStreak: this.wrongStreak,
      hintToken,
    };
  }
}
