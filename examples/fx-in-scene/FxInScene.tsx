import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { DockedHeadline, Stage, Wash, World, cameraAt, hideFromScale, zoomThrough } from "../../kit";
import type { CameraKey } from "../../kit";
import {
  BarsGrow, CardFlip, ChatThread, CubeFold, DigitRoll, DonutRing, FlowSteps, LineDraw, LogoLand, MarkerDraw, MaskedRise,
  NotificationStack, PhoneFrame, ScrambleDecode, SplitFlap, TileDone, TileGrid, Typewriter, TypeRing, phoneScreen,
} from "../../fx";

/**
 * Caso de regresión: efectos de todos los grupos de `fx` dentro de `World` con una cámara que se mueve y
 * hace zoom, cada uno con `start` bien después del cuadro 0 y terminando mucho antes del final de la escena,
 * más un `zoomThrough` final y un `Wash`. Un efecto en reposo (antes de `start` o después de terminar) no
 * debe dejar transformaciones ni opacidades residuales: si las deja, `--check` falla bajo la cámara.
 */
export type FxInSceneProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme };

export const DURATION = 300;
const THROUGH: [number, number] = [236, 299];
const WASH: [number, number] = [276, 299];

// Celdas de 900 x 560 en una grilla de 3 x 3 (coordenadas del mundo).
const CW = 900, CH = 560, GX = 1000, GY = 640;
const cell = (c: number, r: number) => ({ x: c * GX + 60, y: r * GY + 100 });
const center = (c: number, r: number) => ({ x: cell(c, r).x + CW / 2, y: cell(c, r).y + CH / 2 });

const KEYS: CameraKey[] = [
  { f: 0, x: center(0, 0).x, y: center(0, 0).y, scale: 1 },
  { f: 32, x: center(0, 0).x, y: center(0, 0).y, scale: 1 }, // 32 cuadros con la cámara quieta en escala 1
  { f: 60, x: center(1, 0).x, y: center(1, 0).y, scale: 1.1 },
  { f: 90, x: center(2, 0).x, y: center(2, 0).y, scale: 1 },
  { f: 112, x: center(2, 1).x, y: center(2, 1).y, scale: 1.25 },
  { f: 138, x: center(1, 1).x, y: center(1, 1).y, scale: 1 },
  { f: 160, x: center(0, 1).x, y: center(0, 1).y, scale: 1.2 },
  { f: 184, x: center(0, 2).x, y: center(0, 2).y, scale: 1 },
  { f: 210, x: center(1, 2).x, y: center(1, 2).y, scale: 1.15 },
  { f: 236, x: center(2, 2).x, y: center(2, 2).y, scale: 1 },
  { f: 299, x: center(2, 2).x, y: center(2, 2).y, scale: 1 },
];

const TARGET = { x: cell(2, 2).x + 270 + 180, y: cell(2, 2).y + 100 + 180 }; // centro del DonutRing
const camera = (f: number) => cameraAt(f, KEYS, { map: (fr, c) => zoomThrough(fr, THROUGH, c, TARGET, 40), noBlurFrom: THROUGH[0] });

const Slot = ({ c, r, x = 0, y = 0, children }: { c: number; r: number; x?: number; y?: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: cell(c, r).x + x, top: cell(c, r).y + y }}>{children}</div>
);

/**
 * Pila vertical en flujo dentro de una celda: cada elemento ocupa al menos `min` px de alto (lo que antes era una posición fija: 170, 190...)
 * y, si su contenido es más alto con otra tipografía, empuja al siguiente en vez de pisarlo.
 */
const Stack = ({ items }: { items: { min: number; node: React.ReactNode }[] }) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    {items.map((it, i) => <div key={i} style={{ minHeight: it.min }}>{it.node}</div>)}
  </div>
);

function Scene() {
  const frame = useFrame();
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  const cam = camera(frame);
  const screen = phoneScreen(300, 600);
  return (
    <Stage>
      {/* Sin `data-qa-ignore`: lo que está fuera del encuadre de cada tramo de la cámara no se juzga porque `qa` lo ve fuera del cuadro (la grilla de 3 x 3 tiene
          casi todo afuera en cada cuadro: ver la línea "juzgados" del informe), y lo que la cámara recorta mientras se mueve baja solo a `info`. */}
      <div>
        <World camera={cam} width={width} height={height}>
          <Slot c={0} r={0}>
            <Stack items={[
              { min: 170, node: <MaskedRise text="Hola mundo" start={30} fontSize={theme.type.h1} dot /> },
              { min: 190, node: <DigitRoll value={1284} start={44} suffix="+" /> },
              { min: 0, node: <MaskedRise text="Palabra por palabra" by="word" start={52} fontSize={theme.type.h2} /> },
            ]} />
          </Slot>

          <Slot c={1} r={0}><DonutRing value={4} max={4} start={58} width={420} height={420} label="Tareas" unit=" de 4" /></Slot>
          <Slot c={1} r={0} x={440} y={40}><CubeFold start={64} width={440} height={440} /></Slot>

          <Slot c={2} r={0}><BarsGrow start={86} width={900} height={520} /></Slot>

          <Slot c={2} r={1}><NotificationStack start={110} width={900} height={560} /></Slot>

          <Slot c={1} r={1}>
            <PhoneFrame start={134} width={300} height={600} style={{ marginLeft: 0 }}>
              <div style={{ width: screen.width, height: screen.height, background: theme.color.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", color: theme.color.text, fontSize: theme.type.body }}>Pantalla</div>
            </PhoneFrame>
          </Slot>
          <Slot c={1} r={1} x={340} y={20}><ChatThread start={140} width={560} height={540} /></Slot>

          <Slot c={0} r={1}><LineDraw start={156} width={900} height={520} /></Slot>

          <Slot c={0} r={2}>
            <Stack items={[
              { min: 140, node: <Typewriter text="Escribiendo una idea." start={180} fontSize={theme.type.h2} duration={40} /> },
              { min: 130, node: <ScrambleDecode text="Texto descifrado" start={184} fontSize={theme.type.h2} /> },
              { min: 120, node: <SplitFlap text="LISTO" start={188} fontSize={theme.type.h2} /> },
              { min: 0, node: (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 40 }}>
                  <TileDone start={196} width={420} height={150} />
                  <div style={{ marginTop: 10 }}><MarkerDraw text="Resaltado" start={198} width={420} height={120} /></div>
                </div>
              ) },
            ]} />
          </Slot>

          <Slot c={1} r={2}><FlowSteps start={206} width={900} height={500} /></Slot>

          {/* El punto de atravesado (TARGET) es el centro del anillo: durante el zoom final el anillo se agranda hasta ocupar todo. */}
          <Slot c={2} r={2} x={270} y={100}><DonutRing start={214} width={360} height={360} value={4} max={4} unit=" de 4" label="tareas" duration={30} /></Slot>
          <Slot c={2} r={2}><TileGrid start={214} width={250} height={190} /></Slot>
          <Slot c={2} r={2} y={360}><LogoLand start={216} width={200} height={200} /></Slot>
          <Slot c={2} r={2} x={650} y={360}><CardFlip start={222} width={250} height={200} /></Slot>
          <Slot c={2} r={2} x={650}><TypeRing text="Anillo" start={224} width={250} height={190} /></Slot>
        </World>
      </div>
      <DockedHeadline index={1} title="Efectos en escena" subtitle="Cámara en movimiento" frame={frame} start={0} hide={Math.max(hideFromScale(cam.scale), Math.min(1, Math.max(0, (frame - THROUGH[0] + 4) / 3)))} />
      <Wash frame={frame} range={WASH} />
    </Stage>
  );
}

/** Efectos de todos los grupos dentro de `World`, con cámara, atravesado final y velo. */
/** Los temas con nombre: dos neutros y los tres design systems de ejemplo (`--props '{"theme":"neon"}'`). */
const THEMES: Record<string, Theme> = { neutral, dark, editorial, neon, papel };

export function FxInScene({ theme = "neutral" }: FxInSceneProps) {
  return (
    <ThemeProvider theme={typeof theme === "object" ? theme : THEMES[theme] ?? neutral}>
      <Scene />
    </ThemeProvider>
  );
}
