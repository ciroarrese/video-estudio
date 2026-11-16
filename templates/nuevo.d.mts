// Tipos de templates/nuevo.mjs (solo para la prueba).
export const nombreValido: (s: unknown) => boolean;
export const conBarras: (ruta: string) => string;
export const reescribirTema: (texto: string, pref: string) => string;
export const reescribirImports: (texto: string, pref: string) => string;
export const reescribirTsconfig: (texto: string, repo: string) => string;
export const indiceDeEscena: (texto: string, slug: string, nombre: string) => string;
export const indiceDeHistoria: (texto: string, slug: string, nombre: string) => string;
export const USO: string[];
export function nuevo(args: string[], log?: (l: string) => void, err?: (l: string) => void, opciones?: { repo?: string; env?: Record<string, string | undefined> }): number;
