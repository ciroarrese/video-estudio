// Verificación de las fuentes del sistema que usa el video.
//
// `theme.font.files` ya se vigila: una fuente declarada con archivo que no carga hace fallar el render (engine/fontCheck.ts). Pero una
// familia que el tema nombra SIN archivo (`"Inter", sans-serif`, una fuente instalada en la máquina) no se vigila: si no está instalada, el
// navegador cae en silencio a la siguiente de la pila y el video sale con otra tipografía, distinta según la máquina. Esto la detecta mirando la
// letra que de verdad se aplicó en unos cuadros: la primera familia de cada elemento con texto, que no sea genérica (`sans-serif`, `system-ui`...)
// ni venga de un `@font-face` (esas ya las vigila `fontCheck`), tiene que estar instalada; se comprueba midiendo texto contra tres familias base
// (una fuente que existe ensancha o angosta el texto respecto de al menos una de ellas).
//
// Por defecto avisa (`aviso:`); con `--strict-fonts` (o `VE_STRICT_FONTS=1`) falla. No cambia ni un píxel del render.
import type { PwPage } from './browser';

export type FuenteFaltante = { family: string; sample: string };

/** `--strict-fonts` o `VE_STRICT_FONTS=1`: una fuente del sistema que falta hace fallar en vez de avisar. */
export const strictFonts = (o: { strictFonts?: boolean }): boolean => o.strictFonts ?? /^(1|true|si|sí|yes)$/i.test(process.env.VE_STRICT_FONTS ?? '');

/** Cuadros donde se mira: el primero, el del medio y el último (alcanza para ver el titular, el cuerpo y el cierre de la mayoría de los videos). */
export function cuadrosAMirar(total: number): number[] {
  if (total <= 1) return [0];
  return [...new Set([0, Math.floor((total - 1) / 2), total - 1])];
}

/**
 * Corre en la página: recorre los cuadros pedidos y devuelve las familias (primera de la pila) con texto a la vista que no son genéricas, no vienen de
 * un `@font-face` y no se miden distinto de las tres familias base (no instaladas). Sale con `[]` si todo está bien o si no pudo mirar.
 */
export async function fuentesFaltantes(page: PwPage, frames: number[]): Promise<FuenteFaltante[]> {
  return (await page.evaluate(async (list: number[]) => {
    const ve = (window as any).__ve;
    const genericas = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
    const primera = (stack: string): string => {
      const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(stack);
      return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
    };
    const conArchivo = new Set<string>();
    (document as any).fonts?.forEach((f: { family: string }) => conArchivo.add(f.family.replace(/^["']|["']$/g, '').toLowerCase()));
    const vistas = new Map<string, string>();
    for (const n of list) {
      try {
        await ve.setFrame(n);
      } catch {
        continue;
      }
      const raiz = document.getElementById('stage') ?? document.body;
      const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let t = it.nextNode(); t; t = it.nextNode()) {
        const txt = (t.textContent ?? '').trim();
        const el = t.parentElement;
        if (!txt || !el) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const fam = primera(cs.fontFamily);
        if (fam && !vistas.has(fam)) vistas.set(fam, txt.slice(0, 24));
      }
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return [];
    const ancho = (pila: string): number => {
      ctx.font = `72px ${pila}`;
      return ctx.measureText('mmmmmmmmmmlliWQ0123456789').width;
    };
    const bases = ['monospace', 'serif', 'sans-serif'];
    const baseW = bases.map((b) => ancho(b));
    const out: { family: string; sample: string }[] = [];
    for (const [family, sample] of vistas) {
      const lower = family.toLowerCase();
      if (genericas.has(lower) || conArchivo.has(lower)) continue;
      const q = JSON.stringify(family);
      const existe = bases.some((b, i) => Math.abs(ancho(`${q}, ${b}`) - baseW[i]!) > 0.01);
      if (!existe) out.push({ family, sample });
    }
    return out;
  }, frames).catch(() => [])) as FuenteFaltante[];
}

/** Texto del aviso (o del error con `--strict-fonts`) para las familias que faltan. */
export function describirFuentesFaltantes(list: FuenteFaltante[], strict: boolean): string {
  const nombres = list.map((f) => `"${f.family}" (por ejemplo en el texto "${f.sample}")`).join(', ');
  return (
    `${list.length === 1 ? 'La fuente' : 'Las fuentes'} ${nombres} no ${list.length === 1 ? 'está instalada' : 'están instaladas'} en esta máquina: el video sale con la tipografía de reserva de la pila, que cambia de una máquina a otra. ` +
    `Instalala, declarala con archivo en theme.font.files (asset("fonts/x.otf") o import ...?url) o cambiá la familia del tema.` +
    (strict ? '' : ' Con --strict-fonts (o VE_STRICT_FONTS=1) esto es un error.')
  );
}

/** Mira los cuadros y avisa por `log` (o lanza con `strict`). Devuelve las familias que faltan. */
export async function comprobarFuentesDelSistema(page: PwPage, total: number, o: { strict: boolean; log: (m: string) => void }): Promise<FuenteFaltante[]> {
  const faltan = await fuentesFaltantes(page, cuadrosAMirar(total));
  if (!faltan.length) return faltan;
  const msg = describirFuentesFaltantes(faltan, o.strict);
  if (o.strict) throw new Error(msg);
  o.log(`aviso: ${msg}`);
  return faltan;
}
