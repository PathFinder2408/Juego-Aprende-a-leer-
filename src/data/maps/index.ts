import type { MazeMapConfig } from '../../types/campaign';
import ch1MapsData from './ch1.json';

export const CHAPTER_1_MAPS = ch1MapsData as MazeMapConfig[];

export const ALL_MAZE_MAPS: MazeMapConfig[] = [...CHAPTER_1_MAPS];

export function getMazeMapById(mapId: string): MazeMapConfig | undefined {
  return ALL_MAZE_MAPS.find((map) => map.id === mapId);
}
