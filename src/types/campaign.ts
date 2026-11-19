export type BiomeId = 'beach' | 'jungle' | 'canyon' | 'volcano' | 'ruins' | 'star_dome';

export type ReadingFocus =
  | 'vowels_direct'
  | 'consonants_multisyllable'
  | 'digraphs_inverse'
  | 'clusters'
  | 'sentences_comprehension'
  | 'fluency_stories';

export type DomeChallengeMode = 'word' | 'sentence' | 'comprehension';

export type CardPowerKind =
  | 'syllable_magnet'
  | 'extra_bubble'
  | 'audio_hint'
  | 'solar_shield_start'
  | 'long_wave';

export interface SentenceEntry {
  id: string;
  chapterId: string;
  level: number;
  mode: 'sentence' | 'comprehension';
  promptText: string;
  tokens: string[];
  decoys: string[];
  speechText: string;
  storyContext?: string;
  shieldedTokens?: string[];
}

export interface GridPoint {
  col: number;
  row: number;
}

export type MazeTileKind =
  | 'floor'
  | 'wall'
  | 'soft_block'
  | 'hard_block'
  | 'portal'
  | 'warp_a'
  | 'warp_b';

export type PowerUpKind =
  | 'extra_bubble'
  | 'long_wave'
  | 'turbo_boots'
  | 'solar_shield'
  | 'golden_orb';

export type EnemyKind =
  | 'sleepy_shadow'
  | 'mischief_crab'
  | 'mute_echo'
  | 'ash_spark'
  | 'ink_sentry';

export type EnemyBehavior = 'patrol' | 'chase_los' | 'ambush';

export type EnemyBehaviorState = 'normal' | 'stunned' | 'frightened';

export interface MazeEnemySpawn {
  id: string;
  kind: EnemyKind;
  behavior: EnemyBehavior;
  spawn: GridPoint;
  speedTilesPerSec: number;
}

export type BossAbilityKind =
  | 'silence_blocks'
  | 'mist_dash'
  | 'word_scramble'
  | 'ink_trap';

export interface BossConfig {
  id: string;
  name: string;
  chapterId: string;
  biome: BiomeId;
  hp: number;
  speedTilesPerSec: number;
  ability: BossAbilityKind;
  domeChallengeIds: string[];
  defeatRewardCardId: string;
}

export interface MazeMapConfig {
  id: string;
  cols: number;
  rows: number;
  biome: BiomeId;
  layout: string[];
  syllableTokens: string[];
  powerUpPool: PowerUpKind[];
  enemies: MazeEnemySpawn[];
  bossSpawn?: GridPoint;
}

export type StageKind = 'standard' | 'boss';

export interface StageConfig {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  kind: StageKind;
  mapId: string;
  wordIds: string[];
  sentenceIds: string[];
  recommendedDomeMode: DomeChallengeMode;
  bossId?: string;
  starThresholds: {
    twoStarsScore: number;
    threeStarsScore: number;
  };
}

export interface ChapterConfig {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  biome: BiomeId;
  focus: ReadingFocus;
  themeColor: string;
  bossId: string;
  stageIds: string[];
  introStoryId: string;
  outroStoryId: string;
  targetReadingRateWpm?: number;
}

export type StoryTrigger = 'prologue' | 'chapter_intro' | 'chapter_outro' | 'epilogue';

export interface StoryDialogueLine {
  speaker: string;
  portraitKey: string;
  text: string;
  speechRate?: number;
}

export interface StorySequence {
  id: string;
  trigger: StoryTrigger;
  chapterId?: string;
  title: string;
  lines: StoryDialogueLine[];
}

export type MoveDirection = 'none' | 'up' | 'down' | 'left' | 'right';

export type InputAction = 'bubble' | 'power' | 'pause';

export interface UniversalInputState {
  direction: MoveDirection;
  bubblePressed: boolean;
  powerPressed: boolean;
  pausePressed: boolean;
}

export interface ArcadeHudSnapshot {
  stageId: string;
  stageTitle: string;
  hearts: number;
  maxHearts: number;
  hasSolarShield: boolean;
  maxBubbles: number;
  activeBubbles: number;
  waveRange: number;
  collectedSeals: number;
  totalSeals: number;
  portalOpen: boolean;
  score: number;
  frightenedRemainingMs: number;
  paused: boolean;
  equippedCardId: string | null;
}

export interface FluencyMetrics {
  wordsCompleted: number;
  sentencesCompleted: number;
  comprehensionCompleted: number;
  bestAccuracyPercent: number;
}

export interface CampaignProgressState {
  unlockedChapterIds: string[];
  completedStageIds: string[];
  starsByStageId: Record<string, number>;
  seenStoryIds: string[];
  equippedCardId: string | null;
  currentChapterId: string;
  currentStageId: string;
}
