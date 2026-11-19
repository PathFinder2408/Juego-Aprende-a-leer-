import type { MazeMapConfig } from '../../types/campaign';
import ch1MapsData from './ch1.json';
import ch2MapsData from './ch2.json';
import ch3MapsData from './ch3.json';
import ch4MapsData from './ch4.json';
import ch5MapsData from './ch5.json';
import ch6MapsData from './ch6.json';

export const CHAPTER_1_MAPS = ch1MapsData as MazeMapConfig[];
export const CHAPTER_2_MAPS = ch2MapsData as MazeMapConfig[];
export const CHAPTER_3_MAPS = ch3MapsData as MazeMapConfig[];
export const CHAPTER_4_MAPS = ch4MapsData as MazeMapConfig[];
export const CHAPTER_5_MAPS = ch5MapsData as MazeMapConfig[];
export const CHAPTER_6_MAPS = ch6MapsData as MazeMapConfig[];

export const ALL_MAZE_MAPS: MazeMapConfig[] = [
  ...CHAPTER_1_MAPS,
  ...CHAPTER_2_MAPS,
  ...CHAPTER_3_MAPS,
  ...CHAPTER_4_MAPS,
  ...CHAPTER_5_MAPS,
  ...CHAPTER_6_MAPS,
];

export function getMazeMapById(mapId: string): MazeMapConfig | undefined {
  return ALL_MAZE_MAPS.find((map) => map.id === mapId);
}
