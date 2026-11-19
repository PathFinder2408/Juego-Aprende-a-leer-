import type { InputAction, MoveDirection, UniversalInputState } from '../../types/game';

export const DEFAULT_TURN_BUFFER_MS = 160;
export const GAMEPAD_AXIS_DEADZONE = 0.35;

export const KEY_DIRECTION_MAP: Record<string, Exclude<MoveDirection, 'none'>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export const KEY_ACTION_MAP: Record<string, InputAction> = {
  Space: 'bubble',
  Enter: 'bubble',
  NumpadEnter: 'bubble',
  KeyJ: 'bubble',
  KeyZ: 'bubble',
  KeyE: 'power',
  KeyK: 'power',
  KeyX: 'power',
  ShiftLeft: 'power',
  ShiftRight: 'power',
  Escape: 'pause',
  KeyP: 'pause',
};

export const UNIVERSAL_CONTROL_HINTS = {
  move: 'WASD o Flechas',
  bubble: 'Espacio / Enter / J / Z',
  power: 'E / Shift / K / X',
  pause: 'Esc / P',
} as const;

export interface GamepadSnapshot {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean }>;
}

const DIRECTION_BY_KEY_FALLBACK: Record<string, Exclude<MoveDirection, 'none'>> = {
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
};

const ACTION_BY_KEY_FALLBACK: Record<string, InputAction> = {
  ' ': 'bubble',
  enter: 'bubble',
  j: 'bubble',
  z: 'bubble',
  e: 'power',
  k: 'power',
  x: 'power',
  shift: 'power',
  escape: 'pause',
  p: 'pause',
};

export function resolveKeyDirection(code: string, key = ''): MoveDirection {
  const byCode = KEY_DIRECTION_MAP[code];
  if (byCode) return byCode;
  return DIRECTION_BY_KEY_FALLBACK[key.toLowerCase()] ?? 'none';
}

export function resolveKeyAction(code: string, key = ''): InputAction | null {
  const byCode = KEY_ACTION_MAP[code];
  if (byCode) return byCode;
  return ACTION_BY_KEY_FALLBACK[key.toLowerCase()] ?? null;
}

export function readGamepadDirection(pad: GamepadSnapshot | null | undefined): MoveDirection {
  if (!pad) return 'none';

  // Prioridad a cruceta estándar W3C (12=up, 13=down, 14=left, 15=right)
  if (pad.buttons[12]?.pressed) return 'up';
  if (pad.buttons[13]?.pressed) return 'down';
  if (pad.buttons[14]?.pressed) return 'left';
  if (pad.buttons[15]?.pressed) return 'right';

  const axisX = pad.axes[0] ?? 0;
  const axisY = pad.axes[1] ?? 0;

  if (Math.abs(axisX) < GAMEPAD_AXIS_DEADZONE && Math.abs(axisY) < GAMEPAD_AXIS_DEADZONE) {
    return 'none';
  }

  if (Math.abs(axisX) >= Math.abs(axisY)) {
    return axisX < 0 ? 'left' : 'right';
  }
  return axisY < 0 ? 'up' : 'down';
}

export class InputController {
  private readonly turnBufferMs: number;
  private heldDirections: Array<Exclude<MoveDirection, 'none'>> = [];
  private touchDirection: MoveDirection = 'none';
  private touchButtons: Record<InputAction, boolean> = {
    bubble: false,
    power: false,
    pause: false,
  };
  private pendingActions: Record<InputAction, boolean> = {
    bubble: false,
    power: false,
    pause: false,
  };
  private prevGamepadButtons: Record<InputAction, boolean> = {
    bubble: false,
    power: false,
    pause: false,
  };
  private bufferedDirection: MoveDirection = 'none';
  private bufferedUntilMs = -1;

  constructor(turnBufferMs = DEFAULT_TURN_BUFFER_MS) {
    this.turnBufferMs = Math.max(0, turnBufferMs);
  }

  handleKeyDown(code: string, key = '', nowMs = Date.now(), repeat = false): boolean {
    const dir = resolveKeyDirection(code, key);
    if (dir !== 'none') {
      if (!this.heldDirections.includes(dir)) {
        this.heldDirections.push(dir);
      } else {
        // Mueve la tecla recién activada al final para prioridad estilo Pac-Man
        this.heldDirections = [...this.heldDirections.filter((d) => d !== dir), dir];
      }
      this.bufferDirection(dir, nowMs);
      return true;
    }

    const action = resolveKeyAction(code, key);
    if (action) {
      if (!repeat) {
        this.pendingActions[action] = true;
      }
      return true;
    }
    return false;
  }

  handleKeyUp(code: string, key = ''): boolean {
    const dir = resolveKeyDirection(code, key);
    if (dir !== 'none') {
      this.heldDirections = this.heldDirections.filter((d) => d !== dir);
      return true;
    }
    return resolveKeyAction(code, key) !== null;
  }

  setTouchDirection(direction: MoveDirection, nowMs = Date.now()): void {
    this.touchDirection = direction;
    if (direction !== 'none') {
      this.bufferDirection(direction, nowMs);
    }
  }

  setTouchAction(action: InputAction, pressed: boolean): void {
    const wasPressed = this.touchButtons[action];
    this.touchButtons[action] = pressed;
    if (pressed && !wasPressed) {
      this.pendingActions[action] = true;
    }
  }

  triggerAction(action: InputAction): void {
    this.pendingActions[action] = true;
  }

  private bufferDirection(direction: Exclude<MoveDirection, 'none'>, nowMs: number): void {
    this.bufferedDirection = direction;
    this.bufferedUntilMs = nowMs + this.turnBufferMs;
  }

  getActiveDirection(gamepad?: GamepadSnapshot | null): MoveDirection {
    if (this.touchDirection !== 'none') {
      return this.touchDirection;
    }
    const latestKeyboard = this.heldDirections[this.heldDirections.length - 1];
    if (latestKeyboard) {
      return latestKeyboard;
    }
    return readGamepadDirection(gamepad);
  }

  getBufferedDirection(nowMs: number, gamepad?: GamepadSnapshot | null): MoveDirection {
    const active = this.getActiveDirection(gamepad);
    if (active !== 'none') {
      this.bufferedDirection = active;
      this.bufferedUntilMs = nowMs + this.turnBufferMs;
      return active;
    }
    if (this.bufferedDirection !== 'none' && nowMs <= this.bufferedUntilMs) {
      return this.bufferedDirection;
    }
    return 'none';
  }

  clearBufferedDirection(): void {
    this.bufferedDirection = 'none';
    this.bufferedUntilMs = -1;
  }

  sample(nowMs = Date.now(), gamepad: GamepadSnapshot | null = this.readPrimaryGamepad()): UniversalInputState {
    if (gamepad) {
      this.syncGamepadButtons(gamepad);
    } else {
      this.prevGamepadButtons = { bubble: false, power: false, pause: false };
    }

    const direction = this.getBufferedDirection(nowMs, gamepad);
    const state: UniversalInputState = {
      direction,
      bubblePressed: this.pendingActions.bubble,
      powerPressed: this.pendingActions.power,
      pausePressed: this.pendingActions.pause,
    };

    this.pendingActions = { bubble: false, power: false, pause: false };
    return state;
  }

  private syncGamepadButtons(pad: GamepadSnapshot): void {
    const bubbleDown = Boolean(pad.buttons[0]?.pressed);
    const powerDown = Boolean(pad.buttons[1]?.pressed || pad.buttons[2]?.pressed);
    const pauseDown = Boolean(pad.buttons[9]?.pressed);

    if (bubbleDown && !this.prevGamepadButtons.bubble) {
      this.pendingActions.bubble = true;
    }
    if (powerDown && !this.prevGamepadButtons.power) {
      this.pendingActions.power = true;
    }
    if (pauseDown && !this.prevGamepadButtons.pause) {
      this.pendingActions.pause = true;
    }

    this.prevGamepadButtons = {
      bubble: bubbleDown,
      power: powerDown,
      pause: pauseDown,
    };
  }

  private readPrimaryGamepad(): GamepadSnapshot | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    try {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad && pad.connected) {
          return { axes: pad.axes, buttons: pad.buttons };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  reset(): void {
    this.heldDirections = [];
    this.touchDirection = 'none';
    this.touchButtons = { bubble: false, power: false, pause: false };
    this.pendingActions = { bubble: false, power: false, pause: false };
    this.prevGamepadButtons = { bubble: false, power: false, pause: false };
    this.clearBufferedDirection();
  }

  attachToWindow(target: Window | undefined = typeof window !== 'undefined' ? window : undefined): () => void {
    if (!target) return () => undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const handled = this.handleKeyDown(event.code, event.key, Date.now(), event.repeat);
      if (handled && shouldPreventDefault(event.code)) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      this.handleKeyUp(event.code, event.key);
    };

    const onBlur = () => {
      this.reset();
    };

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);

    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    };
  }
}

function shouldPreventDefault(code: string): boolean {
  return (
    code === 'Space' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight'
  );
}

export const universalInput = new InputController();
