import { useContext } from 'react';
import { ConfigContext } from './context';
import { formatOf, type FormatName, type FormatPick } from './format';

export type FormatInfo = {
  /** Formato en el que se está dibujando. */
  format: FormatName;
  width: number;
  height: number;
  /** Elige un valor según el formato; lo que no se indique usa el de `horizontal`. */
  pick<T>(values: FormatPick<T>): T;
};

/**
 * Formato de la pantalla (`horizontal`, `vertical` o `cuadrado`) y un `pick` para adaptar el diseño.
 * El tamaño del escenario sale de `useVideoConfig()` (`width`, `height`); acá se repite por comodidad.
 */
export function useFormat(): FormatInfo {
  const c = useContext(ConfigContext);
  if (!c) throw new Error('useFormat must be used inside <FrameProvider>');
  const format = c.format ?? formatOf(c.width, c.height);
  return { format, width: c.width, height: c.height, pick: (v) => v[format] ?? v.horizontal };
}
