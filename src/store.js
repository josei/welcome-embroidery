/**
 * A small store: one value, read with get(), replaced with set(), and watched with subscribe().
 * React reads it with useSyncExternalStore, so a component re-renders when the value changes.
 * @template T
 * @param {T} initial
 * @returns {{get: () => T, set: (next: T) => void, subscribe: (listener: () => void) => () => void}}
 */
export function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
