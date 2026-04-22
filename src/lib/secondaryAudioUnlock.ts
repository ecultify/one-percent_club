/** Lets GameShowAudio hook into the same user gesture as `NarrationProvider.unlock()`. */

const callbacks = new Set<() => void>();

export function registerSecondaryAudioUnlock(fn: () => void): () => void {
  callbacks.add(fn);
  return () => {
    callbacks.delete(fn);
  };
}

export function runSecondaryAudioUnlocks(): void {
  callbacks.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
