import { vi } from 'vitest';

/** Run fn while silencing the expected render-error noise (React console.error + jsdom's error event report). */
export function quiet<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = (e: Event) => e.preventDefault();
  window.addEventListener('error', onError);
  try {
    return fn();
  } finally {
    window.removeEventListener('error', onError);
    spy.mockRestore();
  }
}
