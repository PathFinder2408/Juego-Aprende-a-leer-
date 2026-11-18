import type { PhysicsParams } from '../types/game';

export const DEFAULT_PHYSICS_PARAMS: PhysicsParams = {
  maxSpeed: 3.2,
  restitution: 0.92,
  frictionAir: 0.015,
  impulseForce: 0.012,
  angularDamping: 0.25,
  uprightStiffness: 0.06,
};

export const PHYSICS_LIMITS: Record<
  keyof PhysicsParams,
  { min: number; max: number; step: number; label: string }
> = {
  maxSpeed: { min: 1, max: 8, step: 0.2, label: 'Velocidad máxima' },
  restitution: { min: 0.3, max: 1.0, step: 0.02, label: 'Rebote (restitución)' },
  frictionAir: { min: 0.0, max: 0.08, step: 0.005, label: 'Fricción del aire' },
  impulseForce: { min: 0.004, max: 0.03, step: 0.002, label: 'Fuerza de impulso' },
  angularDamping: { min: 0.05, max: 0.6, step: 0.05, label: 'Amortiguación giro' },
  uprightStiffness: { min: 0.0, max: 0.15, step: 0.01, label: 'Enderezado lectura' },
};
