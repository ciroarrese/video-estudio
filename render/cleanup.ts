import { rmSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';

// Everything a run creates on disk (temp dir with frames, concat list, partial mp4) is registered here,
// so it is removed on normal exit, on thrown errors and on signals. Chromium's own exit handling is
// bypassed by process.exit(), which skips `finally` blocks: hence the synchronous 'exit' sweep.
const paths = new Set<string>();
const children = new Set<ChildProcess>();

const closers = new Set<() => Promise<unknown>>();
/** Async teardown (e.g. browser.close) awaited by the signal handlers. */
export const trackCloser = (f: () => Promise<unknown>) => {
  closers.add(f);
  return () => void closers.delete(f);
};

export const trackPath = (p: string) => void paths.add(p);
export const untrackPath = (p: string) => void paths.delete(p);
export const trackChild = (c: ChildProcess) => {
  children.add(c);
  c.once('close', () => children.delete(c));
};

export function sweep(): void {
  for (const c of children) {
    try {
      c.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
  children.clear();
  for (const p of paths) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  paths.clear();
}

process.on('exit', sweep);

let interrupted = false;
export const isInterrupted = () => interrupted;

let installed = false;
/** CLI only: turn SIGINT/SIGTERM/SIGHUP into "sweep, then exit with 128+signal". */
export function installSignalHandlers(): void {
  if (installed) return;
  installed = true;
  const num: Record<string, number> = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 };
  for (const sig of Object.keys(num)) {
    process.on(sig as NodeJS.Signals, async () => {
      interrupted = true;
      sweep();
      // Playwright's own signal handling is off (it would exit before our sweep), so close browsers here.
      await Promise.race([Promise.allSettled([...closers].map((f) => f())), new Promise((r) => setTimeout(r, 5000))]);
      console.error(`\nInterrumpido (${sig}); archivos temporales eliminados.`);
      process.exit(128 + num[sig]!);
    });
  }
}
