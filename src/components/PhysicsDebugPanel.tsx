import { DEFAULT_PHYSICS_PARAMS, PHYSICS_LIMITS } from '../config/physics';
import type { PhysicsParams } from '../types/game';

interface PhysicsDebugPanelProps {
  params: PhysicsParams;
  onChange: (key: keyof PhysicsParams, value: number) => void;
  onResetDefaults: () => void;
}

const PARAM_KEYS = Object.keys(PHYSICS_LIMITS) as Array<keyof PhysicsParams>;

export function PhysicsDebugPanel({ params, onChange, onResetDefaults }: PhysicsDebugPanelProps) {
  return (
    <aside className="debug-panel" aria-label="Panel de física antigravedad">
      <h2>Debug de Física (en vivo)</h2>
      {PARAM_KEYS.map((key) => {
        const meta = PHYSICS_LIMITS[key];
        const value = params[key];
        return (
          <label key={key} className="slider-row">
            <span className="slider-label">
              <span>{meta.label}</span>
              <strong>{value.toFixed(key === 'impulseForce' || key === 'frictionAir' ? 3 : 2)}</strong>
            </span>
            <input
              type="range"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={value}
              onChange={(e) => onChange(key, Number(e.target.value))}
            />
          </label>
        );
      })}
      <button type="button" className="btn btn-secondary" onClick={onResetDefaults}>
        Restaurar valores ({DEFAULT_PHYSICS_PARAMS.maxSpeed})
      </button>
    </aside>
  );
}
