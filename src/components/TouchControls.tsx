import { useEffect, useState } from 'react';
import { universalInput } from '../features/input/InputController';
import type { InputAction, MoveDirection } from '../types/game';

interface TouchControlsProps {
  hasPowerEquipped?: boolean;
}

const DPAD_BUTTONS: ReadonlyArray<{
  dir: Exclude<MoveDirection, 'none'>;
  label: string;
  ariaLabel: string;
  slotClass: string;
}> = [
  { dir: 'up', label: '▲', ariaLabel: 'Mover arriba', slotClass: 'touch-dpad-btn--up' },
  { dir: 'left', label: '◀', ariaLabel: 'Mover izquierda', slotClass: 'touch-dpad-btn--left' },
  { dir: 'right', label: '▶', ariaLabel: 'Mover derecha', slotClass: 'touch-dpad-btn--right' },
  { dir: 'down', label: '▼', ariaLabel: 'Mover abajo', slotClass: 'touch-dpad-btn--down' },
];

export function TouchControls({ hasPowerEquipped = false }: TouchControlsProps) {
  const [activeDir, setActiveDir] = useState<MoveDirection>('none');
  const [bubbleDown, setBubbleDown] = useState(false);
  const [powerDown, setPowerDown] = useState(false);

  useEffect(() => {
    return () => {
      universalInput.setTouchDirection('none');
      universalInput.setTouchAction('bubble', false);
      universalInput.setTouchAction('power', false);
    };
  }, []);

  const handleDirPress = (dir: MoveDirection) => {
    setActiveDir(dir);
    universalInput.setTouchDirection(dir);
  };

  const handleDirRelease = (dir: Exclude<MoveDirection, 'none'>) => {
    setActiveDir((prev) => {
      if (prev === dir) {
        universalInput.setTouchDirection('none');
        return 'none';
      }
      return prev;
    });
  };

  const handleAction = (action: Extract<InputAction, 'bubble' | 'power'>, pressed: boolean) => {
    universalInput.setTouchAction(action, pressed);
    if (action === 'bubble') {
      setBubbleDown(pressed);
    } else {
      setPowerDown(pressed);
    }
  };

  return (
    <div className="touch-controls-overlay" aria-label="Controles táctiles en pantalla">
      <div className="touch-dpad" role="group" aria-label="Cruceta de movimiento">
        {DPAD_BUTTONS.map((btn) => (
          <button
            key={btn.dir}
            type="button"
            className={`touch-dpad-btn ${btn.slotClass} ${activeDir === btn.dir ? 'is-pressed' : ''}`}
            aria-label={btn.ariaLabel}
            onPointerDown={(e) => {
              e.preventDefault();
              handleDirPress(btn.dir);
            }}
            onPointerUp={() => handleDirRelease(btn.dir)}
            onPointerLeave={() => handleDirRelease(btn.dir)}
            onPointerCancel={() => handleDirRelease(btn.dir)}
          >
            {btn.label}
          </button>
        ))}
        <div className="touch-dpad-center" aria-hidden="true" />
      </div>

      <div className="touch-actions" role="group" aria-label="Botones de acción">
        <button
          type="button"
          className={`touch-action-btn touch-action-btn--power ${powerDown ? 'is-pressed' : ''}`}
          aria-label="Usar poder"
          title={hasPowerEquipped ? 'Usar carta equipada (E)' : 'Poder de carta (E)'}
          onPointerDown={(e) => {
            e.preventDefault();
            handleAction('power', true);
          }}
          onPointerUp={() => handleAction('power', false)}
          onPointerLeave={() => handleAction('power', false)}
          onPointerCancel={() => handleAction('power', false)}
        >
          <span>★</span>
          <small>Poder</small>
        </button>

        <button
          type="button"
          className={`touch-action-btn touch-action-btn--bubble ${bubbleDown ? 'is-pressed' : ''}`}
          aria-label="Soltar burbuja"
          onPointerDown={(e) => {
            e.preventDefault();
            handleAction('bubble', true);
          }}
          onPointerUp={() => handleAction('bubble', false)}
          onPointerLeave={() => handleAction('bubble', false)}
          onPointerCancel={() => handleAction('bubble', false)}
        >
          <span>🫧</span>
          <small>Burbuja</small>
        </button>
      </div>
    </div>
  );
}
