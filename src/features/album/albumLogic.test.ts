import { describe, expect, it } from 'vitest';
import cardsData from '../../data/cards.json';
import type { CardEntry } from '../../types/game';
import {
  ALBUM_COMPLETION_BONUS_POWER,
  formatCardDescription,
  getCardEffectivePower,
  getEquippedCardPower,
  validateCardBlank,
} from './albumLogic';

const SAMPLE_CARD: CardEntry = {
  id: 'card-solin',
  wordId: 'sol',
  creatureName: 'Solín',
  element: 'Sol',
  rarity: 'Común',
  stars: 1,
  art: '/assets/creature-solin.png',
  accentColor: '#facc15',
  moveName: 'Rayo Tibio',
  movePower: 30,
  descriptionTemplate: 'Brilla como el ___ en la mañana.',
  missingWord: 'SOL',
  wordChoices: ['SOL', 'PAN', 'MAR'],
};

describe('albumLogic', () => {
  it('valida la palabra correcta sin importar mayúsculas o espacios', () => {
    const ok = validateCardBlank(SAMPLE_CARD, ' sol ');
    expect(ok.correct).toBe(true);
    expect(ok.bonusPower).toBe(ALBUM_COMPLETION_BONUS_POWER);
    expect(ok.completedSentence).toBe('Brilla como el SOL en la mañana.');

    const wrong = validateCardBlank(SAMPLE_CARD, 'PAN');
    expect(wrong.correct).toBe(false);
    expect(wrong.bonusPower).toBe(0);
  });

  it('calcula el poder efectivo y formatea la descripción según estado', () => {
    expect(getCardEffectivePower(SAMPLE_CARD, false)).toBe(30);
    expect(getCardEffectivePower(SAMPLE_CARD, true)).toBe(30 + ALBUM_COMPLETION_BONUS_POWER);

    expect(formatCardDescription(SAMPLE_CARD, false)).toBe('Brilla como el _____ en la mañana.');
    expect(formatCardDescription(SAMPLE_CARD, true)).toBe('Brilla como el SOL en la mañana.');
  });

  it('cubre cartas equipables con poderes para los 6 capítulos', () => {
    const cards = cardsData as CardEntry[];
    const chapters = new Set(cards.map((c) => c.chapterId));
    expect(chapters.size).toBe(6);

    expect(getEquippedCardPower('card-solin')).toBe('audio_hint');
    expect(getEquippedCardPower('card-sapin')).toBe('extra_bubble');
    expect(getEquippedCardPower('card-mumu')).toBe('syllable_magnet');
    expect(getEquippedCardPower('card-chispa')).toBe('long_wave');
    expect(getEquippedCardPower('card-brujula')).toBe('solar_shield_start');
    expect(getEquippedCardPower(null)).toBeNull();
  });
});
