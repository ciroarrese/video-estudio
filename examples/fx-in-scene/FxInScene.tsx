import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import { ThemeProvider, dark, neutral, useTheme } from "../../themes";
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
export type FxInSceneProps = { theme?: "neutral" | "dark" | Theme };

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

const TARGET = { x: center(2, 2).x, y: center(2, 2).y };
const camera = (f: number) => cameraAt(f, KEYS, { map: (fr, c) => zoomThrough(fr, THROUGH, c, TARGET, 40), noBlurFrom: THROUGH[0] });

const Slot = ({ c, r, x = 0, y = 0, children }: { c: number; r: number; x?: number; y?: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: cell(c, r).x + x, top: cell(c, r).y + y }}>{children}</div>
);

function Scene() {
  const frame = useFrame();
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  const cam = camera(frame);
  const screen = phoneScreen(300, 600);
  return (
    <Stage>
      {/* Todo lo que está fuera del encuadre de cada tramo de la cámara es intencional. */}
      <div data-qa-ignore="offscreen safe-area clip">
        <World camera={cam} width={width} height={height}>
          <Slot c={0} r={0}>
            <MaskedRise text="Hola mundo" start={30} fontSize={theme.type.h1} dot />
          </Slot>
          <Slot c={0} r={0} y={170}>
            <DigitRoll value={1284} start={44} suffix="+" />
          </Slot>
          <Slot c={0} r={0} y={360}>
            <MaskedRise text="Palabra por palabra" by="word" start={52} fontSize={theme.type.h2} />
          </Slot>

          <Slot c={1} r={0}><DonutRing value={4} max={4} start={58} width={420} height={420} label="Tareas" /></Slot>
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

          <Slot c={0} r={2}><Typewriter text="Escribiendo una idea." start={180} fontSize={theme.type.h2} duration={40} /></Slot>
          <Slot c={0} r={2} y={100}><ScrambleDecode text="Texto descifrado" start={184} fontSize={theme.type.h2} /></Slot>
          <Slot c={0} r={2} y={200}><SplitFlap text="LISTO" start={188} fontSize={theme.type.h2} /></Slot>
          <Slot c={0} r={2} y={330}><TileDone start={196} width={420} height={150} /></Slot>
          <Slot c={0} r={2} y={330} x={460}><MarkerDraw text="Resaltado" start={198} width={420} height={120} /></Slot>

          <Slot c={1} r={2}><FlowSteps start={206} width={900} height={500} /></Slot>
          <Slot c={1} r={2} y={0}><div /></Slot>

          <Slot c={2} r={2}><TileGrid start={214} width={460} height={300} /></Slot>
          <Slot c={2} r={2} x={480}><LogoLand start={216} width={300} height={300} /></Slot>
          <Slot c={2} r={2} y={310}><CardFlip start={222} width={420} height={250} /></Slot>
          <Slot c={2} r={2} x={440} y={310}><TypeRing text="Anillo" start={224} width={440} height={250} /></Slot>
        </World>
      </div>
      <DockedHeadline index={1} title="Efectos en escena" subtitle="Cámara en movimiento" frame={frame} start={0} hide={hideFromScale(cam.scale)} />
      <Wash frame={frame} range={WASH} />
    </Stage>
  );
}

/** Efectos de todos los grupos dentro de `World`, con cámara, atravesado final y velo. */
export function FxInScene({ theme = "neutral" }: FxInSceneProps) {
  return (
    <ThemeProvider theme={typeof theme === "object" ? theme : theme === "dark" ? dark : neutral}>
      <Scene />
    </ThemeProvider>
  );
}
