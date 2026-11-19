import { useContext, useMemo, type ReactNode } from 'react';
import { TimeContext } from './context';

/**
 * Cuadro ABSOLUTO del video (el del reloj del `FrameProvider`), sin importar en cuántas `Sequence` esté metido el componente.
 * `useFrame()` devuelve el cuadro relativo a la `Sequence` más cercana; esto, el del video entero. Es una función pura del cuadro.
 */
export function useAbsoluteFrame(): number {
  const t = useContext(TimeContext);
  if (!t) throw new Error('useAbsoluteFrame must be used inside <FrameProvider>');
  return t.frame + t.offset;
}

/**
 * Monta a sus hijos con el reloj del video entero: adentro, `useFrame()` devuelve el cuadro absoluto y una `Sequence` anidada cuenta
 * desde el cuadro 0 del video. Sirve para capas que tienen que seguir iguales al cruzar un corte entre escenas (partículas de fondo).
 * Sigue siendo función pura del cuadro.
 */
export function AbsoluteFrame({ children }: { children?: ReactNode }) {
  const t = useContext(TimeContext);
  if (!t) throw new Error('<AbsoluteFrame> must be used inside <FrameProvider>');
  const abs = t.frame + t.offset;
  const state = useMemo(() => ({ frame: abs, offset: 0, end: Infinity }), [abs]);
  return <TimeContext.Provider value={state}>{children}</TimeContext.Provider>;
}
