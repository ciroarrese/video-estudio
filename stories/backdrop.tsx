import React, { createContext, useContext } from "react";
import { AbsoluteFrame } from "../engine";
import { VeilContentContext } from "../kit";

/** Lo que acepta la ranura `backdrop`: un nodo, o un componente sin props (puede usar `useTheme()`, `useVideoConfig()` y demás ayudas). */
export type StoryBackdrop = React.ReactNode | React.ComponentType;

/** Lo que `StoryStage` lee para dibujar la ranura; lo provee `composeStory` (o `StoryBackdropProvider` en una historia armada a mano). `null` = sin ranura. */
export const BackdropContext = createContext<StoryBackdrop>(null);

/**
 * La capa de fondo global de una historia (`spec.backdrop`): se monta con el reloj del VIDEO entero (adentro `useFrame()` devuelve el cuadro
 * absoluto, no el del bloque; una partícula está en el mismo lugar antes y después de un corte) y queda marcada como adorno para `qa`:
 * `data-qa-decor` (su texto, si lo hubiera, no se juzga con `min-size` ni `contrast`) y `data-qa-ignore="covered vacio"` (no cuenta como tapa
 * ni como ocupación del cuadro). El contraste del contenido sobre la capa SÍ se juzga: `qa` mide el color real que se ve detrás del texto.
 *
 * Sirve también para las piezas propias que se montan antes o después de la historia (una intro, un cierre): `<BackdropLayer>{misPuntos}</BackdropLayer>`
 * dentro de su `Stage` (o de un `StoryStage`), como primer hijo (debajo del contenido). Es posicional (`position: absolute; inset: 0`) y no recibe clics.
 */
export function BackdropLayer({ children }: { children?: StoryBackdrop }) {
  if (children === null || children === undefined || children === false) return null;
  const body = typeof children === "function" ? React.createElement(children as React.ComponentType) : (children as React.ReactNode);
  return (
    <div aria-hidden="true" data-qa-decor="" data-qa-ignore="covered vacio" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <AbsoluteFrame>{body}</AbsoluteFrame>
    </div>
  );
}

/**
 * Activa la ranura para todo lo que cuelgue de él: cada `StoryStage` la dibuja justo sobre el fondo y bajo el contenido, y cada `Wash`
 * (también el de las escenas de tema) la lleva por encima de su color, así que no desaparece ni parpadea en una transición. `composeStory` lo
 * hace solo con `spec.backdrop`; en una historia armada a mano, envolvé los bloques con él.
 */
export function StoryBackdropProvider({ backdrop, children }: { backdrop?: StoryBackdrop; children?: React.ReactNode }) {
  if (backdrop === null || backdrop === undefined || backdrop === false) return <>{children}</>;
  return (
    <BackdropContext.Provider value={backdrop}>
      <VeilContentContext.Provider value={<BackdropLayer>{backdrop}</BackdropLayer>}>{children}</VeilContentContext.Provider>
    </BackdropContext.Provider>
  );
}

/** La ranura activa (la de `StoryBackdropProvider`), o `null`. */
export const useStoryBackdrop = (): StoryBackdrop => useContext(BackdropContext);
