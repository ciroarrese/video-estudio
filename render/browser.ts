import { createRequire } from 'node:module';

/** Minimal structural types for the parts of Playwright we use (it is an optional peer dependency). */
export interface PwPage {
  goto(url: string, o?: object): Promise<unknown>;
  evaluate<R, A = undefined>(fn: (a: A) => R | Promise<R>, arg?: A): Promise<R>;
  screenshot(o: { type: 'png'; clip: { x: number; y: number; width: number; height: number } }): Promise<Buffer>;
  on(ev: string, cb: (...a: any[]) => void): void;
  close(): Promise<void>;
}
export interface PwCdp {
  send(method: string, params?: object): Promise<any>;
}
export interface PwContext {
  newPage(): Promise<PwPage>;
  newCDPSession(page: PwPage): Promise<PwCdp>;
  close(): Promise<void>;
}
export interface PwBrowser {
  version(): string;
  newContext(o: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PwContext>;
  close(): Promise<void>;
}

async function loadPlaywright(): Promise<{ chromium: { launch(o?: object): Promise<PwBrowser> } }> {
  const name = 'playwright';
  try {
    return (await import(/* @vite-ignore */ name)) as never;
  } catch {
    /* ESM resolution failed; fall back to CJS resolution (NODE_PATH, global installs) */
  }
  try {
    const mod = createRequire(import.meta.url)(name);
    return mod.chromium ? mod : mod.default;
  } catch {
    throw new Error(
      'No se pudo cargar "playwright". Instalalo (npm i -D playwright) o expone una instalacion global con NODE_PATH. ' +
        'Chromium de Playwright es un requisito; usa VE_CHROMIUM=/ruta/al/chrome para un ejecutable propio.',
    );
  }
}

export async function launchChromium(): Promise<PwBrowser> {
  const { chromium } = await loadPlaywright();
  const executablePath = process.env.VE_CHROMIUM || undefined;
  try {
    return await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      args: [
        '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-partial-raster',
        ...(process.env.VE_CHROMIUM_ARGS ? process.env.VE_CHROMIUM_ARGS.split(/\s+/).filter(Boolean) : []),
      ],
    });
  } catch (e) {
    throw new Error(`No se pudo lanzar Chromium${executablePath ? ` (${executablePath})` : ''}: ${(e as Error).message}`);
  }
}
