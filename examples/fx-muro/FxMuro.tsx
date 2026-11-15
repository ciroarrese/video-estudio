import React from "react";
import { ThemeProvider, dark, editorial, neon, neutral, papel, surfaceStyle, cornerRadius, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { Eyebrow, NestedScene, Stage } from "../../kit";
import {
  BarsGrow, CardFlip, ChatThread, DigitRoll, DonutRing, FlowSteps, Globe, LineDraw, Loop, MaskedRise, NotificationStack,
  RadarMorph, ScrambleDecode, SplitFlap, TileDone, TileGrid, Typewriter, BeforeAfter, CommandPalette, MarkerDraw,
} from "../../fx";
import type { Density, LoopProps } from "../../fx";
import { AnnotationDemo } from "../annotation-demo/AnnotationDemo";

/**
 * Muestrario de efectos en baldosas chicas (285 x 150 de contenido), todo en lazo (`Loop`): ningún efecto queda quieto con su imagen final, y cada baldosa
 * lleva su propio desfase. Es el caso de prueba de `density` ("auto" achica letra, trazos y márgenes de LineDraw, TileDone, NotificationStack, DigitRoll,
 * CardFlip, FlowSteps, RadarMorph, ChatThread, BeforeAfter, CommandPalette y MarkerDraw a la caja) y de `NestedScene` (una escena entera, la de
 * `annotation-demo`, mostrada chica y viva). Con `density: "off"` cada efecto usa su tamaño de diseño, para compararlos.
 *
 * ChatThread y CommandPalette llevan 0,55 fijo (con `auto` el piso de 0,3 las deja ilegibles: su caja de diseño es de 760 x 560 y 900 x 560, muy distinta de una baldosa ancha y baja).
 *
 * Por qué las baldosas son `data-qa-decor` (decisión única, vale para todas): un muestrario chico es adorno. Cada baldosa es una reproducción reducida de un efecto
 * cuyo texto es de muestra ("Hecho", "Aprobado", "Clave") y su letra es la de una baldosa, no la de un cuadro completo; con `density="auto"` baja por debajo
 * de los 18 px a propósito. `qa` no juzga `min-size` ni `contrast` ahí, pero sí `clip`, `overlap` y `safe-area`. Lo que una persona tiene que leer
 * (el rótulo con el nombre del efecto, fuera de la marca) cumple tamaño y contraste del tema.
 */
export type FxMuroProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme; density?: "auto" | "off" };
export const DURATION = 240;

const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
const COLS = 6, TW = 285, TH = 190, GAP = 14, X0 = 70, Y0 = 70, LABEL = 40;
const DUR = 60;

type Baldosa = { name: string; loop?: Partial<LoopProps>; /** regla de `qa` que esta baldosa calla a propósito (con su motivo en la lista) */ ignore?: string; render: (w: number, h: number, d?: Density) => React.ReactNode };

const BALDOSAS: Baldosa[] = [
  { name: "LineDraw", render: (w, h, d) => <LineDraw width={w} height={h} density={d} duration={DUR} /> },
  { name: "TileDone", render: (w, h, d) => <TileDone width={w} height={h} density={d} duration={30} /> },
  { name: "NotificationStack", ignore: "clip" /* cada tarjeta entra desde arriba del recuadro de la baldosa a propósito: durante la llegada queda cortada por su borde */, render: (w, h, d) => <NotificationStack width={w} height={h} density={d} duration={DUR} items={[{ title: "Hecho", body: "Control aprobado", time: "ya" }, { title: "Nuevo", body: "Llegó un aviso", time: "1 min" }]} /> },
  { name: "DigitRoll", render: (w, _h, d) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><DigitRoll width={w - 30} density={d} duration={DUR} value={12480} suffix="%" /></div> },
  { name: "CardFlip", loop: { mode: "pingpong" }, render: (w, h, d) => <CardFlip width={w} height={h} density={d} duration={DUR} /> },
  { name: "DonutRing", render: (w, h) => <DonutRing width={w} height={h} duration={DUR} value={72} max={100} label="" /> },
  { name: "BarsGrow", render: (w, h) => <BarsGrow width={w} height={h} duration={DUR} data={[40, 64, 52]} labels={["A", "B", "C"]} format={() => ""} /> },
  { name: "FlowSteps", render: (w, h, d) => <FlowSteps width={w} height={h} density={d} duration={DUR} steps={[{ title: "Leer" }, { title: "Armar" }, { title: "Revisar" }]} /> },
  { name: "ChatThread", render: (w, h, d) => <ChatThread width={w} height={h} density={d && 0.55} duration={DUR} messages={[{ from: "them", text: "¿Aprobás?" }, { from: "me", text: "Aprobado." }]} /> },
  { name: "BeforeAfter", loop: { mode: "pingpong" }, render: (w, h, d) => <BeforeAfter width={w} height={h} density={d} duration={DUR} /> },
  { name: "TileGrid", render: (w, h) => <TileGrid width={w - 40} height={h - 30} cols={6} rows={3} duration={DUR} lit={0.7} /> },
  { name: "MaskedRise", render: (_w, _h) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><MaskedRise duration={DUR} text="Título" /></div> },
  { name: "Typewriter", render: (_w, _h) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Typewriter duration={DUR} text="Listo" /></div> },
  { name: "ScrambleDecode", render: (_w, _h) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><ScrambleDecode duration={DUR} text="Listo" /></div> },
  { name: "SplitFlap", render: (_w, _h) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><SplitFlap duration={DUR} text="OK" /></div> },
  { name: "RadarMorph", render: (w, h, d) => <RadarMorph width={w} height={h} density={d} duration={DUR} /> },
  { name: "CommandPalette", render: (w, h, d) => <CommandPalette width={w} height={h} density={d && 0.55} duration={DUR} items={[{ label: "Nuevo", hint: "N" }, { label: "Nueva carpeta", hint: "C" }]} /> },
  { name: "MarkerDraw", ignore: "signal" /* es una baldosa del muestrario, no una escena que señale algo: la regla `signal` avisaría de un trazo a mano bajo un tema que no señala así */, render: (w, h, d) => <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><MarkerDraw width={w - 40} height={h - 30} density={d} duration={DUR} text="Clave" /></div> },
  { name: "Globe", render: (w, h) => <Globe width={w} height={h} duration={DUR} bg="surface" /> },
];

function Muro({ density }: { density: "auto" | "off" }) {
  const t = useTheme();
  const d: Density | undefined = density === "auto" ? "auto" : undefined;
  return (
    <Stage>
      {BALDOSAS.map((b, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        return (
          <div
            key={b.name}
            style={{
              position: "absolute", left: X0 + col * (TW + GAP), top: Y0 + row * (TH + GAP), width: TW, height: TH, boxSizing: "border-box", overflow: "hidden",
              ...surfaceStyle(t, "card", { level: "sm", corner: "panel" }),
            }}
          >
            {/* `data-qa-decor`: cada baldosa es una reproducción chica de un efecto (su letra es la de una baldosa, no la de un cuadro completo): `qa` no juzga su tamaño ni su contraste, sí `clip` y `overlap`. Solo cubre la baldosa, no el rótulo. */}
            <div data-qa-decor="" data-qa-ignore={b.ignore} style={{ position: "relative", width: "100%", height: TH - LABEL, overflow: "hidden" }}>
              <Loop duration={b.name === "TileDone" ? 30 : DUR} pause={24} offset={i * 9} mode="fade" {...b.loop}>{b.render(TW, TH - LABEL, d)}</Loop>
            </div>
            <div style={{ height: LABEL, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 16px", lineHeight: 1.25, whiteSpace: "nowrap" }}>
              <Eyebrow color={t.color.text} size={t.type.eyebrow * 0.8}>{b.name}</Eyebrow>
            </div>
          </div>
        );
      })}
      {/* la última baldosa: una escena entera (annotation-demo) viva y chica, en el tema del muestrario */}
      <div style={{ position: "absolute", left: X0 + (BALDOSAS.length % COLS) * (TW + GAP), top: Y0 + Math.floor(BALDOSAS.length / COLS) * (TH + GAP), width: TW, height: TH, boxSizing: "border-box", overflow: "hidden", borderRadius: cornerRadius(t, "card"), ...surfaceStyle(t, "card", { level: "sm", corner: "panel" }) }}>
        <Loop duration={150} pause={0} mode="fade" fadeOut={10}><NestedScene scene={AnnotationDemo} sceneProps={{ theme: t }} width={TW} height={TH - LABEL} /></Loop>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: LABEL, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 16px", lineHeight: 1.25, whiteSpace: "nowrap" }}>
          <Eyebrow color={t.color.text} size={t.type.eyebrow * 0.8}>NestedScene</Eyebrow>
        </div>
      </div>
    </Stage>
  );
}

export function FxMuro({ theme = "neutral", density = "auto" }: FxMuroProps) {
  const t = typeof theme === "object" ? theme : TEMAS[theme] ?? neutral;
  return (
    <ThemeProvider theme={t}>
      <Muro density={density} />
    </ThemeProvider>
  );
}
