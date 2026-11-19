import type {
  ArcadeHudSnapshot,
  CampaignProgressState,
  CardPowerKind,
  DomeChallengeMode,
  FluencyMetrics,
} from './campaign';

export type {
  ArcadeHudSnapshot,
  BiomeId,
  BossAbilityKind,
  BossConfig,
  CampaignProgressState,
  CardPowerKind,
  ChapterConfig,
  DomeChallengeMode,
  EnemyBehavior,
  EnemyBehaviorState,
  EnemyKind,
  FluencyMetrics,
  GridPoint,
  InputAction,
  MazeEnemySpawn,
  MazeMapConfig,
  MazeTileKind,
  MoveDirection,
  PowerUpKind,
  ReadingFocus,
  SentenceEntry,
  StageConfig,
  StageKind,
  StoryDialogueLine,
  StorySequence,
  StoryTrigger,
  UniversalInputState,
} from './campaign';

export interface PhysicsParams {
  maxSpeed: number;
  restitution: number;
  frictionAir: number;
  impulseForce: number;
  angularDamping: number;
  uprightStiffness: number;
}

export interface WordEntry {
  id: string;
  word: string;
  tokens: string[];
  level: number;
  creatureName: string;
  creatureColor: string;
  sprite?: string;
  chapterId?: string;
  category?: string;
}

export interface WildSpawn {
  id: string;
  wordId: string;
  x: number;
  y: number;
}

export interface WorldProp {
  id: string;
  kind: 'palm' | 'ball' | 'coconut' | 'grass';
  x: number;
  y: number;
}

export interface WorldConfig {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  wildSpawns: WildSpawn[];
  props: WorldProp[];
}

export interface CardEntry {
  id: string;
  wordId: string;
  creatureName: string;
  element: string;
  rarity: 'Común' | 'Rara' | 'Brillante';
  stars: number;
  art: string;
  accentColor: string;
  moveName: string;
  movePower: number;
  descriptionTemplate: string;
  missingWord: string;
  wordChoices: string[];
  chapterId?: string;
  powerKind?: CardPowerKind;
  powerHint?: string;
}

export type ActiveScreen = 'home' | 'world' | 'antigravity' | 'cards' | 'campaign' | 'maze';

export interface DifficultyLevelConfig {
  level: number;
  label: string;
  decoyCount: number;
  speedMultiplier: number;
  decoyPool: string[];
}

export interface DifficultyConfig {
  streakToLevelUp: number;
  streakToLevelDown: number;
  pauseReminderMinutes: number;
  levels: DifficultyLevelConfig[];
}

export interface ProgressionSnapshot {
  level: number;
  label: string;
  decoyCount: number;
  speedMultiplier: number;
  correctStreak: number;
  wrongStreak: number;
}

export interface AccessibilitySettings {
  voiceEnabled: boolean;
  sfxEnabled: boolean;
  slowFloating: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface PersistedProgressionState {
  level: number;
  correctStreak: number;
  wrongStreak: number;
}

export interface SaveStateV1 {
  version: 1;
  capturedWordIds: string[];
  completedCardIds: string[];
  progression: PersistedProgressionState;
  accessibility: AccessibilitySettings;
  updatedAt: string;
}

export interface SaveStateV2 {
  version: 2;
  capturedWordIds: string[];
  completedCardIds: string[];
  progression: PersistedProgressionState;
  accessibility: AccessibilitySettings;
  campaign: CampaignProgressState;
  fluency: FluencyMetrics;
  updatedAt: string;
}

export type SaveState = SaveStateV1;

export interface PuzzleStatePayload {
  word: string;
  tokens: string[];
  collectedIndex: number;
  wrongStreak: number;
  hintToken: string | null;
}

export interface LetterHitPayload {
  token: string;
  expected: string;
  correct: boolean;
  collectedIndex: number;
}

export interface CapturePayload {
  wordId: string;
  word: string;
  creatureName: string;
}

export interface GameEventMap {
  'physics:update': Partial<PhysicsParams>;
  'letter:hit': LetterHitPayload;
  'puzzle:state': PuzzleStatePayload;
  'puzzle:reset': undefined;
  'encounter:start': { wordId: string };
  'screen:change': ActiveScreen;
  'progression:update': ProgressionSnapshot;
  'accessibility:update': AccessibilitySettings;
  'maze:hud': ArcadeHudSnapshot;
  'maze:pause': boolean;
  'maze:portal': {
    stageId: string;
    wordIds: string[];
    sentenceIds: string[];
    mode: DomeChallengeMode;
  };
  'stage:complete': {
    stageId: string;
    score: number;
    stars: number;
  };
  capture: CapturePayload;
}
