import type { CardEntry } from '../../types/game';

export const ALBUM_COMPLETION_BONUS_POWER = 15;
export const ALBUM_COMPLETION_BONUS_STARS = 5;

export interface BlankEvaluation {
  correct: boolean;
  completedSentence: string;
  bonusPower: number;
}

export function validateCardBlank(card: CardEntry, chosenWord: string): BlankEvaluation {
  const normalizedChoice = chosenWord.trim().toUpperCase();
  const normalizedTarget = card.missingWord.trim().toUpperCase();
  const correct = normalizedChoice === normalizedTarget;

  return {
    correct,
    completedSentence: card.descriptionTemplate.replace('___', card.missingWord),
    bonusPower: correct ? ALBUM_COMPLETION_BONUS_POWER : 0,
  };
}

export function getCardEffectivePower(card: CardEntry, isBlankCompleted: boolean): number {
  return card.movePower + (isBlankCompleted ? ALBUM_COMPLETION_BONUS_POWER : 0);
}

export function formatCardDescription(card: CardEntry, isBlankCompleted: boolean): string {
  return card.descriptionTemplate.replace('___', isBlankCompleted ? card.missingWord : '_____');
}
