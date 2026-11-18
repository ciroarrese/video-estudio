// Tipos de render/config-local.mjs.
export const NOMBRE_CONFIG_LOCAL: string;
export const CLAVES_CONFIG_LOCAL: { videosDir: 'VE_VIDEOS_DIR'; outDir: 'VE_OUT_DIR'; cacheDir: 'VE_CACHE_DIR' };
export function rutaDeConfig(valor: string, raiz?: string): string;
export function leerConfigLocal(raiz?: string, env?: Record<string, string | undefined>): { archivo: string; valores: { videosDir?: string; outDir?: string; cacheDir?: string } } | null;
export function resolverConfig(env?: Record<string, string | undefined>, raiz?: string): Record<'VE_VIDEOS_DIR' | 'VE_OUT_DIR' | 'VE_CACHE_DIR', { valor: string | null; origen: string | null }>;
export function aplicarConfigLocal(env?: Record<string, string | undefined>, raiz?: string): Record<string, string>;
