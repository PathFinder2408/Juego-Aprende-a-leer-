import type { AccessibilitySettings } from '../types/game';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  voiceEnabled: true,
  sfxEnabled: true,
  musicEnabled: true,
  slowFloating: false,
  reducedMotion: false,
  highContrast: false,
};

export const SLOW_FLOATING_MULTIPLIER = 0.55;
