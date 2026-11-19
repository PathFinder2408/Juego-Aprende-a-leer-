import skinsData from '../data/skins.json';
import type { PlayerSkinConfig, PlayerSkinId } from '../types/game';

export const PLAYER_SKINS = skinsData as PlayerSkinConfig[];
export const DEFAULT_PLAYER_SKIN: PlayerSkinId = 'explorer';

const SKIN_MAP = new Map<PlayerSkinId, PlayerSkinConfig>(
  PLAYER_SKINS.map((skin) => [skin.id, skin])
);

export function isValidPlayerSkinId(value: unknown): value is PlayerSkinId {
  return typeof value === 'string' && SKIN_MAP.has(value as PlayerSkinId);
}

export function sanitizePlayerSkinId(raw: unknown): PlayerSkinId {
  return isValidPlayerSkinId(raw) ? raw : DEFAULT_PLAYER_SKIN;
}

const FALLBACK_SKIN: PlayerSkinConfig = PLAYER_SKINS[0] ?? {
  id: 'explorer',
  name: 'Explorador',
  subtitle: 'Traje clásico de aventura',
  badge: '🧭',
  sprite: '/assets/explorer.png',
  textureKey: 'explorer',
  torsoColor: '#14b8a6',
  torsoLight: '#5eead4',
  torsoDark: '#0f766e',
  torsoStroke: '#134e4a',
  accentColor: '#facc15',
  jerseyNumber: null,
};

export function getPlayerSkinConfig(skinId?: PlayerSkinId | null): PlayerSkinConfig {
  const safeId = sanitizePlayerSkinId(skinId);
  return SKIN_MAP.get(safeId) ?? FALLBACK_SKIN;
}
