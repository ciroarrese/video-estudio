import React, { useLayoutEffect, useRef } from 'react';
import { useFrame } from './useFrame';

export type FrameCanvasProps = {
  /** Tamano logico en px (el de la caja CSS). */
  width: number;
  height: number;
  /** Dibuja TODO el cuadro: el lienzo ya viene limpio y en coordenadas logicas (0..width, 0..height). */
  draw: (ctx: CanvasRenderingContext2D, frame: number, size: { width: number; height: number }) => void;
  /** Valores extra de los que depende el dibujo (el cuadro ya cuenta siempre). Hoy se redibuja en cada render igualmente. */
  deps?: React.DependencyList;
  /** Cuadro explicito; por defecto `useFrame()`. */
  frame?: number;
  /** Resolucion de respaldo: multiplica los pixeles reales. Por defecto `devicePixelRatio` (min 1). */
  pixelRatio?: number;
  style?: React.CSSProperties;
};

/**
 * `<canvas>` que se redibuja por completo en cada cuadro.
 *
 * Determinismo: es la unica excepcion (junto con `holdRender`) a "sin efectos". El dibujo se hace en un
 * `useLayoutEffect` sin dependencias (corre en cada commit, tambien dentro de `flushSync`, asi que
 * `__ve.setFrame(n)` captura el cuadro ya dibujado). Cada vez se reinicia el contexto por completo (`reset()` o reasignar el ancho), se limpia
 * todo y se dibuja desde cero: no queda nada del cuadro anterior. `draw` debe ser pura (sin `Math.random`,
 * sin estado entre llamadas).
 */
export function FrameCanvas({ width, height, draw, frame, pixelRatio, style }: FrameCanvasProps) {
  const ctxFrame = useFrame();
  const f = frame ?? ctxFrame;
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = Math.max(1, pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);

  // Sin lista de dependencias a proposito: redibuja siempre (barato y a prueba de historial).
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Reinicio total: descarta cualquier estado que haya dejado un dibujo anterior (save() sin restore(),
    // clip, estilos, transformaciones), tambien si ese dibujo lanzo un error. `reset()` si existe;
    // si no, reasignar el ancho limpia el lienzo y todo su estado.
    const resettable = ctx as CanvasRenderingContext2D & { reset?: () => void };
    if (typeof resettable.reset === 'function') resettable.reset();
    else canvas.width = pw;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    try {
      ctx.scale(pw / width, ph / height);
      draw(ctx, f, { width, height });
    } finally {
      ctx.restore();
    }
  });

  return (
    <canvas
      ref={ref}
      width={pw}
      height={ph}
      style={{ display: 'block', width, height, ...style }}
    />
  );
}
