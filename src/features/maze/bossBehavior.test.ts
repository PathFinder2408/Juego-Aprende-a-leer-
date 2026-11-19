import { describe, expect, it } from 'vitest';
import type { MazeMapConfig } from '../../types/campaign';
import {
  BOSS_ABILITY_PROFILES,
  BOSS_STUN_DURATION_MS,
  createBossState,
  getAllBosses,
  getBossById,
  stepBoss,
} from './bossBehavior';
import { createEnemyGridContext } from './enemyAI';
import { MazeEngine } from './mazeEngine';

function createBossArena(): MazeMapConfig {
  return {
    id: 'boss-arena-test',
    cols: 9,
    rows: 7,
    biome: 'star_dome',
    layout: [
      '#########',
      '#P      #',
      '# # # # #',
      '#   S   #',
      '# # # # #',
      '#      X#',
      '#########',
    ],
    syllableTokens: ['SOL'],
    powerUpPool: [],
    enemies: [],
    bossSpawn: { col: 3, row: 1 },
  };
}

describe('bossBehavior y catálogo de 6 jefes JSON', () => {
  it('define los 6 jefes por configuración JSON incluyendo a Don Silencio', () => {
    const bosses = getAllBosses();
    expect(bosses).toHaveLength(6);

    const chapters = new Set(bosses.map((b) => b.chapterId));
    expect(chapters.size).toBe(6);

    const finalBoss = getBossById('boss-silencio');
    expect(finalBoss).toBeDefined();
    expect(finalBoss?.name).toBe('Don Silencio');
    expect(finalBoss?.hp).toBe(3);

    for (const boss of bosses) {
      expect(BOSS_ABILITY_PROFILES[boss.ability]).toBeDefined();
      expect(boss.hp).toBe(3);
    }
  });

  it('requiere aturdimiento x3 con burbujas sónicas para derrotar al jefe y usa su habilidad JSON', () => {
    const map = createBossArena();
    const engine = new MazeEngine(map, { initialWaveRange: 2, bubbleFuseMs: 300 });
    const bossConfig = getBossById('boss-cangrejo')!;
    const boss = createBossState(bossConfig, { col: 3, row: 1 });

    // Disparar habilidad de bloques mudos cuando expira cooldown
    const ctxIdle = createEnemyGridContext(engine.getState(), false);
    const abilityEvents = stepBoss(
      boss,
      ctxIdle,
      BOSS_ABILITY_PROFILES[boss.ability].cooldownMs / 1000 + 0.1
    );
    const abilityEv = abilityEvents.find((e) => e.type === 'boss_ability_used');
    expect(abilityEv).toBeDefined();
    if (abilityEv?.type === 'boss_ability_used') {
      expect(abilityEv.candidateBlocks.length).toBeGreaterThan(0);
    }

    // 3 golpes con onda de burbuja desde (1, 1) -> rango 2 alcanza hasta (3, 1)
    for (let hit = 1; hit <= 3; hit += 1) {
      boss.x = 3;
      boss.y = 1;
      boss.tile = { col: 3, row: 1 };
      engine.placeBubble();
      const boom = engine.step(0.35, {});
      const hitCtx = createEnemyGridContext(boom.snapshot, false);
      const hitEvents = stepBoss(boss, hitCtx, 0.05);

      expect(hitEvents.some((e) => e.type === 'boss_hit' && e.remainingHp === 3 - hit)).toBe(true);

      if (hit < 3) {
        expect(boss.state).toBe('stunned');
        // Dejar pasar la onda actual y terminar el aturdimiento antes del siguiente golpe
        engine.step(0.6, {});
        const clearCtx = createEnemyGridContext(engine.getState(), false);
        stepBoss(boss, clearCtx, BOSS_STUN_DURATION_MS / 1000 + 0.1);
        expect(boss.state).toBe('patrol');
      } else {
        expect(boss.state).toBe('defeated');
        expect(hitEvents.some((e) => e.type === 'boss_defeated' && e.bossId === 'boss-cangrejo')).toBe(true);
      }
    }
  });
});
