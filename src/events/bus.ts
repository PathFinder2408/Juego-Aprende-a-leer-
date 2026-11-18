import type { GameEventMap } from '../types/game';

type Listener<T> = (payload: T) => void;

class TypedEventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends undefined ? [] : [GameEventMap[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const payload = args[0] as GameEventMap[K];
    for (const listener of set) {
      (listener as Listener<GameEventMap[K]>)(payload);
    }
  }
}

export const gameBus = new TypedEventBus();
