import type React from "react";
import type { AnnotationMarkSetting } from "../themes";
import { useTheme } from "../themes";
import { focusOpacity } from "./Callout";
import { calloutState } from "./layout";
import { useFrameOr } from "./util";

/**
 * Atenúa "lo demás" mientras una señal `focus` (`style.annotation.mark`) mira un objetivo: es la mitad que le falta a `Callout` con `variant="focus"`
 * (o con un tema cuya señal es `focus`). Envuelve todo lo que NO es el objetivo; el objetivo y el `Callout` van afuera, sin atenuar.
 *
 * ```tsx
 * <FocusGroup range={RANGE}>{/* tarjetas, filas, etiquetas: lo demás *\/}</FocusGroup>
 * <Tarjeta de="objetivo" />
 * <Callout target={rect} range={RANGE} />
 * ```
 *
 * Con cualquier otra señal (o con la señal apagada) no hace nada: no emite `opacity` ni cambia el marcado de lo que envuelve, así que se puede dejar
 * puesto siempre y la escena sigue siendo una función pura del cuadro. La opacidad es la de `focusOpacity(theme, calloutState(frame, range), variant)`
 * (`1 - style.annotation.dim` con la señal puesta).
 *
 * Por qué una opacidad en el contenedor y no una capa translúcida encima: la capa tapa el objetivo (hay que recortarle un hueco) y cae sobre el texto
 * que no se quiere tocar; la opacidad atenúa solo lo que envuelve y nada más. Se comprobó con `render --check --check-all` que ambas pasan, pero
 * **no** se le debe agregar `isolation`, `will-change` ni `filter` al contenedor (con `isolation: isolate` `--check` falló en los cuadros donde la
 * opacidad entra y sale: Chromium rasteriza distinto la capa según su historial). La pieza emite la propiedad solo mientras la señal está
 * (la `key` cambia con ella, así que no queda `opacity: 1` residual), como el resto de las piezas del kit.
 *
 * El texto de lo atenuado baja de contraste a propósito mientras dura la señal (es el efecto buscado): `qa` lo trata como atenuación en curso
 * (`data-qa-focus`) y no como defecto. Si hay texto que tiene que seguir leyéndose, sacalo del grupo.
 */
export function FocusGroup({ range, variant, ramp, frame, style, children }: {
  range: [number, number];
  /** La misma `variant` que lleva el `Callout` (si fuerza otra señal); sin ella manda el tema. */
  variant?: AnnotationMarkSetting;
  ramp?: number;
  frame?: number;
  /** Para acomodar el contenedor (por defecto cubre el cuadro: `position: absolute; inset: 0`). */
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const o = focusOpacity(theme, calloutState(f, range, { ramp }), variant);
  const on = o < 1;
  return (
    <div
      key={on ? "dim" : "rest"}
      data-qa-focus={on ? String(o) : undefined}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style, opacity: on ? o : undefined }}
    >
      {children}
    </div>
  );
}
