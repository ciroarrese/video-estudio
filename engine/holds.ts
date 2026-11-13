let nextHandle = 1;
const holds = new Map<number, string>();

/** Block frame capture until releaseRender(handle). Use for fonts, images, anything async. */
export function holdRender(label = 'unnamed'): number {
  const h = nextHandle++;
  holds.set(h, label);
  return h;
}

export function releaseRender(handle: number): void {
  holds.delete(handle);
}

/** Labels of holds that are still pending. */
export function pendingHolds(): string[] {
  return [...holds.values()];
}

/** Resolves once no holds are pending (polls each ms). Rejects after timeoutMs. */
export function waitForHolds(timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (holds.size === 0) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for holds: ${pendingHolds().join(', ')}`));
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}
