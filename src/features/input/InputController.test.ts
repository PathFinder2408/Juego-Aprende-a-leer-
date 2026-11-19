import { describe, expect, it } from 'vitest';
import { InputController, type GamepadSnapshot } from './InputController';

function makeGamepad(
  axes: number[] = [0, 0],
  pressedIndices: number[] = []
): GamepadSnapshot {
  const buttons = Array.from({ length: 16 }, (_, idx) => ({
    pressed: pressedIndices.includes(idx),
  }));
  return { axes, buttons };
}

describe('InputController', () => {
  it('mapea WASD, flechas y acciones universales con prioridad a la última tecla', () => {
    const ctrl = new InputController(150);

    ctrl.handleKeyDown('ArrowRight', 'ArrowRight', 100);
    expect(ctrl.sample(100, null).direction).toBe('right');

    // Al presionar W sin soltar Flecha Derecha, W toma prioridad y al soltar W vuelve a derecha
    ctrl.handleKeyDown('KeyW', 'w', 120);
    expect(ctrl.sample(120, null).direction).toBe('up');

    ctrl.handleKeyUp('KeyW', 'w');
    expect(ctrl.sample(130, null).direction).toBe('right');
    ctrl.handleKeyUp('ArrowRight', 'ArrowRight');

    ctrl.handleKeyDown('Space', ' ', 200, false);
    ctrl.handleKeyDown('Space', ' ', 210, true); // repeat ignorado
    ctrl.handleKeyDown('KeyE', 'e', 210, false);
    ctrl.handleKeyDown('Escape', 'Escape', 210, false);

    const frame1 = ctrl.sample(210, null);
    expect(frame1.bubblePressed).toBe(true);
    expect(frame1.powerPressed).toBe(true);
    expect(frame1.pausePressed).toBe(true);

    const frame2 = ctrl.sample(220, null);
    expect(frame2.bubblePressed).toBe(false);
    expect(frame2.powerPressed).toBe(false);
    expect(frame2.pausePressed).toBe(false);
  });

  it('mantiene el buffer de giro temporal tras soltar la tecla', () => {
    const ctrl = new InputController(160);
    ctrl.handleKeyDown('KeyA', 'a', 1000);
    ctrl.handleKeyUp('KeyA', 'a');

    expect(ctrl.sample(1100, null).direction).toBe('left');
    expect(ctrl.sample(1200, null).direction).toBe('none');
  });

  it('prioriza controles táctiles sobre teclado y lee gamepad sin disparos repetidos', () => {
    const ctrl = new InputController(160);
    ctrl.handleKeyDown('KeyD', 'd', 500);
    ctrl.setTouchDirection('down', 510);

    expect(ctrl.sample(510, null).direction).toBe('down');
    ctrl.setTouchDirection('none', 520);
    expect(ctrl.sample(520, null).direction).toBe('right');
    ctrl.handleKeyUp('KeyD', 'd');

    ctrl.setTouchAction('bubble', true);
    ctrl.setTouchAction('bubble', true); // mismo estado presionado no re-dispara
    expect(ctrl.sample(530, null).bubblePressed).toBe(true);
    expect(ctrl.sample(540, null).bubblePressed).toBe(false);

    // Gamepad: stick con deadzone, D-Pad y botones A/B/Start por flanco
    const padMove = makeGamepad([-0.8, 0.1], [0]);
    const s1 = ctrl.sample(600, padMove);
    expect(s1.direction).toBe('left');
    expect(s1.bubblePressed).toBe(true);

    const neutralPad = makeGamepad([0.1, 0.1], [0, 9]);
    expect(ctrl.getActiveDirection(neutralPad)).toBe('none'); // dentro de deadzone
    const s2 = ctrl.sample(616, neutralPad);
    expect(s2.bubblePressed).toBe(false); // sigue presionado, no re-dispara
    expect(s2.pausePressed).toBe(true); // flanco nuevo en Start
    expect(ctrl.sample(800, neutralPad).direction).toBe('none'); // expira buffer de giro
  });

  it('limpia direcciones y acciones pendientes al hacer reset', () => {
    const ctrl = new InputController(160);
    ctrl.handleKeyDown('KeyW', 'w', 100);
    ctrl.triggerAction('power');
    ctrl.reset();

    const state = ctrl.sample(120, null);
    expect(state).toEqual({
      direction: 'none',
      bubblePressed: false,
      powerPressed: false,
      pausePressed: false,
    });
  });
});
