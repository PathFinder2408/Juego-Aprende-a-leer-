import { describe, expect, it } from 'vitest';
import {
  GOLDEN_ORB_DURATION_MS,
  INVULNERABILITY_AFTER_HIT_MS,
  applyPlayerEnemyHit,
  applySurvivalPowerUp,
  createSurvivalState,
  stepSurvivalTimers,
} from './powerups';

describe('powerups y supervivencia del laberinto', () => {
  it('aplica Escudo Solar y Orbe Dorado con textos es-CL', () => {
    let state = createSurvivalState(3);

    const shieldRes = applySurvivalPowerUp(state, 'solar_shield');
    state = shieldRes.state;
    expect(state.hasSolarShield).toBe(true);
    expect(shieldRes.speechText).toContain('Escudo');

    const orbRes = applySurvivalPowerUp(state, 'golden_orb');
    state = orbRes.state;
    expect(state.frightenedRemainingMs).toBe(GOLDEN_ORB_DURATION_MS);
    expect(orbRes.speechText).toContain('Orbe');

    state = stepSurvivalTimers(state, 2500);
    expect(state.frightenedRemainingMs).toBe(GOLDEN_ORB_DURATION_MS - 2500);
  });

  it('absorbe un golpe con Escudo Solar, otorga invulnerabilidad breve y dispara checkpoint al agotar corazones', () => {
    let state = createSurvivalState(3);
    state = applySurvivalPowerUp(state, 'solar_shield').state;

    // Primer golpe lo absorbe el escudo
    const hit1 = applyPlayerEnemyHit(state);
    expect(hit1.absorbedByShield).toBe(true);
    expect(hit1.state.hasSolarShield).toBe(false);
    expect(hit1.state.hearts).toBe(3);
    expect(hit1.state.invulnerableRemainingMs).toBe(INVULNERABILITY_AFTER_HIT_MS);

    // Golpe inmediato durante invulnerabilidad se ignora
    const hitIgnored = applyPlayerEnemyHit(hit1.state);
    expect(hitIgnored.ignoredByInvulnerability).toBe(true);
    expect(hitIgnored.state.hearts).toBe(3);

    // Expira invulnerabilidad y recibe 3 golpes hasta checkpoint
    state = stepSurvivalTimers(hit1.state, INVULNERABILITY_AFTER_HIT_MS + 10);
    state = applyPlayerEnemyHit(state).state;
    expect(state.hearts).toBe(2);

    state = stepSurvivalTimers(state, INVULNERABILITY_AFTER_HIT_MS + 10);
    state = applyPlayerEnemyHit(state).state;
    expect(state.hearts).toBe(1);

    state = stepSurvivalTimers(state, INVULNERABILITY_AFTER_HIT_MS + 10);
    const hitCheckpoint = applyPlayerEnemyHit(state);
    expect(hitCheckpoint.checkpointTriggered).toBe(true);
    expect(hitCheckpoint.state.hearts).toBe(3);
    expect(hitCheckpoint.state.checkpointRespawns).toBe(1);
    expect(hitCheckpoint.state.invulnerableRemainingMs).toBe(INVULNERABILITY_AFTER_HIT_MS);
  });
});
