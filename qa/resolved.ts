import { annotationLook, dark, editorial, neon, neutral, papel, resolveStyle, themeCharacter } from '../themes';
import type { Theme } from '../themes';
// Lo que cada design system con nombre resuelve para señalar y para salir de una escena (sin navegador: se puede probar sola).

const NAMED: Record<string, Theme> = { neutral, dark, editorial, neon, papel };

/** Lo que cada design system resuelve para señalar y para salir de una escena (lo que `Callout`, `exitPower` y `Wash` van a hacer con él). */
export type ThemeResolved = { theme: string; signal: string; exit: string; transition: string; character: string; dim: number };

export function resolveThemes(themes: string[]): ThemeResolved[] {
  return themes.map((name) => {
    const t = NAMED[name]!;
    const st = resolveStyle(t);
    return { theme: name, signal: annotationLook(t).mark, exit: st.motion.exit, transition: st.motion.transition, character: themeCharacter(t), dim: st.annotation.dim };
  });
}

/** Tabla de lo que resolvió cada sistema (señal, salida de cámara, transición, carácter): sirve para ver por qué una escena se ve distinta en cada uno. */
export function formatResolved(rows: ThemeResolved[]): string {
  const w = Math.max(9, ...rows.map((r) => r.theme.length + 1));
  const col = (k: keyof ThemeResolved) => Math.max(k.length, ...rows.map((r) => String(r[k]).length)) + 2;
  const keys: (keyof ThemeResolved)[] = ['signal', 'exit', 'transition', 'character'];
  const head = 'sistema'.padEnd(w) + keys.map((k) => String(k === 'signal' ? 'señal' : k === 'exit' ? 'salida' : k === 'transition' ? 'transición' : 'carácter').padEnd(col(k))).join('');
  const lines = rows.map((r) => r.theme.padEnd(w) + keys.map((k) => String(r[k]).padEnd(col(k))).join(''));
  return `qué resolvió cada sistema (señal de Callout, salida de la cámara, transición entre escenas, carácter)\n${head}\n${lines.join('\n')}`;
}
