// Reconoce el error de un color de datos que un tema no declara (sin dependencias del navegador: se prueba sola).
/**
 * El error de un tema que no declara un color de datos (`theme.data.<nombre>`) que el video lee: `Tema "neutral": no hay un color de datos "libre". ...`
 * (themes/data.ts). Ese tema no puede dibujar el video: no es un defecto del video sino un sistema donde no aplica.
 */
const FALTA_DATO = /Tema "([^"]*)": no hay un color de datos "([^"]+)"/;

/** Si `e` es el error de un color de datos que el tema no declara: el nombre que falta; si no, `null` (cualquier otro error se propaga). */
export function datoFaltante(e: unknown): { theme: string; name: string } | null {
  const m = FALTA_DATO.exec(e instanceof Error ? e.message : String(e));
  return m ? { theme: m[1]!, name: m[2]! } : null;
}

