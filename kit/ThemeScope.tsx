import React, { useLayoutEffect, useState } from "react";
import { holdRender, releaseRender, reportFontFailure } from "../engine";
import { ThemeProvider } from "../themes";
import type { Theme } from "../themes";
import { firstFamily, fontFaceCss } from "./fonts";

type FontsApi = { load(font: string, text?: string): Promise<unknown>; check(font: string, text?: string): boolean };
const fontsApi = (): FontsApi | null => (typeof document === "undefined" ? null : ((document as unknown as { fonts?: FontsApi }).fonts ?? null));

/** Fuentes ya pedidas (clave `peso|familia|src`): evita frenar la captura dos veces por lo mismo. */
const requested = new Set<string>();

/**
 * Pide las fuentes locales del tema (si todavía no están) y frena la captura (`holdRender`) hasta que carguen.
 * Devuelve cuántas cargas terminaron, para volver a renderizar el mismo cuadro con la fuente ya lista
 * (lo que se mide con el texto, como el ancho de `fitText`, se recalcula). No cambia el resultado de un cuadro:
 * una vez cargada la fuente, el mismo cuadro sale siempre igual.
 */
export function useThemeFonts(theme: Theme): number {
  const [loaded, setLoaded] = useState(0);
  const files = theme.font.files;
  const face = firstFamily(theme.font.family);
  useLayoutEffect(() => {
    const api = fontsApi();
    if (!api || !files?.length) return;
    for (const f of files) {
      const key = `${f.weight}|${face}|${f.src}`;
      if (requested.has(key)) continue;
      requested.add(key);
      const id = holdRender(`ThemeScope: fuente ${face} ${f.weight}`);
      const done = () => {
        setLoaded((n) => n + 1);
        releaseRender(id);
      };
      const spec = `${f.weight} 16px ${JSON.stringify(face)}`;
      const url = (() => {
        try {
          return new URL(f.src, document.baseURI).href;
        } catch {
          return f.src;
        }
      })();
      // Una fuente que no carga NO puede pasar callada: el navegador cae a la siguiente de la pila y el video sale con otra
      // tipografía. Se informa (engine/fontCheck.ts) y el runtime lo convierte en un error de render (o un aviso, en borradores).
      const fail = (reason: string) => reportFontFailure({ family: face, url, weight: f.weight, reason });
      try {
        api.load(spec).then(
          (faces) => {
            if (!Array.isArray(faces) || faces.length === 0) fail("el @font-face no se aplicó a ninguna cara (¿peso o familia que no coinciden?)");
            else if (!api.check(spec)) fail("document.fonts.check dice que no quedó cargada");
            done();
          },
          (e: unknown) => {
            fail(`no se pudo descargar o leer el archivo (${e instanceof Error ? e.message : String(e)}; ¿404 o archivo dañado?)`);
            done();
          },
        );
      } catch (e) {
        fail(String(e));
        done();
      }
    }
  });
  return loaded;
}

export type ThemeScopeProps = {
  theme: Theme;
  /** Pinta una superficie con el fondo, el color de texto y la tipografía del tema (para una herramienta oscura dentro de un video claro). Por defecto no pinta nada. */
  paint?: boolean;
  /** Estilo de la superficie (solo con `paint`): posición y tamaño, radio, sombra. */
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/**
 * Cambia el tema de un subárbol: todo lo que haya adentro (piezas del kit, efectos de `fx/`, canvas, medición de texto)
 * lee `useTheme()` y obtiene `theme`; lo de afuera sigue con el tema del video. Se puede anidar y no tiene estado entre cuadros.
 * Además declara el `@font-face` de las fuentes locales del tema y espera su carga antes de capturar.
 *
 * Es el mismo `ThemeProvider` de `themes/` más lo que hace falta para el cambio de tema por escena.
 */
export function ThemeScope({ theme, paint = false, style, children }: ThemeScopeProps) {
  useThemeFonts(theme);
  const fontCss = fontFaceCss(theme);
  return (
    <ThemeProvider theme={theme}>
      {fontCss && <style>{fontCss}</style>}
      {paint ? (
        <div
          style={{
            position: "relative",
            background: theme.color.bg,
            color: theme.color.text,
            fontFamily: theme.font.family,
            fontWeight: theme.font.weights.regular,
            ...style,
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </ThemeProvider>
  );
}
