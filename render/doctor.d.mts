// Tipos de render/doctor.mjs (solo para la prueba).
export type Resultado = { nombre: string; estado: 'ok' | 'falta' | 'aviso'; detalle?: string; arreglo?: string };
export function nodeMinimoDe(rango: unknown): number | null;
export function cumpleNode(version: unknown, minimo: number): boolean;
export function versionDeFfmpeg(salida: unknown): string | null;
export function tieneCodificador(salida: unknown, nombre: string): boolean;
export function formatearBytes(n: number): string;
export function carpetasDeSalida(env: Record<string, string | undefined>, raizRepo: string, cwd: string): { videosExterna: string | null; cache: string; salida: string };
export function lineaDeInforme(r: Resultado): string;
export function codigoDeSalida(resultados: Resultado[]): number;
export function diagnosticar(opciones?: { rapido?: boolean }): Promise<Resultado[]>;
