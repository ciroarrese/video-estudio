// Escena inicial. Se copia con: bash templates/nuevo.sh escena <slug> <nombre-de-escena>
// (queda en videos/<slug>/<nombre-de-escena>/; ver docs/guia-escenas.md).
//
// Reglas que esta plantilla ya cumple (ver docs/reglas.md):
//  - Todo sale del cuadro (`useFrame`) y del tema (`useTheme`): nada de estado, azar ni temporizadores.
//  - Coordenadas del MUNDO dentro de <World>; la cámara se mueve con cuadros clave.
//  - El titular se aparta solo cuando la cámara se acerca (`hideFromScale`).
//  - Un acercamiento rápido en la acción clave, un clic, un garabato y un atravesado final.
//  - Termina atravesando un elemento y con un velo (`Wash`) hacia la escena siguiente.
import React from "react";
import { useFrame, useVideoConfig } from "../../engine";
import {
  Cursor, DockedHeadline, DoodleCircle, Stage, Wash, World,
  cameraAt, hideFromScale, kf, typed, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";
import { ThemeProvider, useTheme } from "../../themes";
import { theme as videoTheme } from "../theme";

/** Duración de la escena en cuadros (30 fps = 5 s). La historia la lee de acá. */
export const DURACION = 150;

export type SceneProps = {
  /** Titular de la escena (una línea). */
  title: string;
  /** Texto que se escribe debajo del titular; opcional. */
  subtitle?: string;
};

// --- Diseño en coordenadas del mundo (1 unidad = 1 px a escala 1, lienzo de 1920x1080) ---
// Dejamos libre la franja de arriba (y < 170) para el titular en la vista general.
const PANEL = { x: 260, y: 200, w: 1400, h: 700 };
const CARD = { w: 400, h: 220 };
const cardPos = (i: number) => ({ x: PANEL.x + 50 + i * 450, y: PANEL.y + 90 });
const cardCenter = (i: number) => ({ x: cardPos(i).x + CARD.w / 2, y: cardPos(i).y + CARD.h / 2 });
const PICK = 1; // tarjeta que se destaca
const FILAS = ["Elemento alfa", "Elemento beta", "Elemento gamma"]; // contenido ficticio

// --- Línea de tiempo (cuadros) ---
const T = {
  zoom: 40, // llega al acercamiento sobre la tarjeta elegida
  click: 62,
  doodle: 72,
  through: [112, 149] as [number, number], // atravesado final
  wash: [133, 149] as [number, number],
};

// Tres cuadros clave: vista general -> acercamiento rápido -> sostener.
const KEYS: CameraKey[] = [
  { f: 0, x: 960, y: 540, scale: 1 },
  { f: T.zoom, x: cardCenter(PICK).x, y: cardCenter(PICK).y, scale: 1.8 },
  { f: 110, x: cardCenter(PICK).x, y: cardCenter(PICK).y, scale: 1.8 },
];

// El final atraviesa un punto del panel; el desenfoque se apaga en ese tramo.
const THROUGH_TARGET = { x: PANEL.x + PANEL.w - 140, y: PANEL.y + 540 };
const camera = (f: number) =>
  cameraAt(f, KEYS, {
    map: (fr, c) => zoomThrough(fr, T.through, c, THROUGH_TARGET, 40),
    noBlurFrom: T.through[0],
  });

/** Contenido de la escena SIN `Stage`: es lo que usa la historia (que ya trae su propio `Stage`). */
export function SceneBody({ title, subtitle }: SceneProps) {
  const f = useFrame();
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const cam = camera(f);
  const picked = f >= T.click;
  const target = cardCenter(PICK);

  return (
    <>
      <World camera={cam} width={width} height={height}>
        {/* Panel: se recrea con primitivas del tema, no con una captura. */}
        <div
          style={{
            position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h,
            background: t.color.surface, border: `1px solid ${t.color.border}`,
            borderRadius: t.radius.lg, boxShadow: t.shadow.lg, opacity: kf(f, [0, 18], [0, 1]),
          }}
        >
          <div style={{ padding: "26px 50px", fontSize: t.type.body, fontWeight: t.font.weights.semibold, color: t.color.text }}>
            Panel de ejemplo
          </div>
        </div>

        {[0, 1, 2].map((i) => {
          const a = kf(f, [8 + i * 6, 26 + i * 6], [0, 1]); // entrada escalonada
          const sel = i === PICK && picked;
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: cardPos(i).x, top: cardPos(i).y + (1 - a) * 30,
                width: CARD.w, height: CARD.h, boxSizing: "border-box", padding: 30, opacity: a,
                background: t.color.surfaceAlt, borderRadius: t.radius.panel,
                border: `2px solid ${sel ? t.color.accent : t.color.border}`,
              }}
            >
              <div style={{ fontSize: t.type.eyebrow, color: t.color.textMuted }}>Indicador {i + 1}</div>
              <div style={{ fontSize: t.type.stat * 0.6, fontWeight: t.font.weights.stat, color: t.color.chart[i % t.color.chart.length] }}>
                {(i + 1) * 21}
              </div>
            </div>
          );
        })}

        {FILAS.map((r, i) => (
          <div
            key={r}
            style={{
              position: "absolute", left: PANEL.x + 50, top: PANEL.y + 360 + i * 76, width: PANEL.w - 100, height: 58,
              boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 24px",
              background: t.color.bg, border: `1px solid ${t.color.border}`, borderRadius: t.radius.md,
              fontSize: t.type.eyebrow, color: t.color.text, opacity: kf(f, [30 + i * 5, 48 + i * 5], [0, 1]),
            }}
          >
            {r}
          </div>
        ))}

        {/* Un garabato sobre lo que importa (también en coordenadas del mundo). Cada uno lleva un `id` único. */}
        <DoodleCircle start={T.doodle} end={105} id="tpl-circle" cx={target.x} cy={target.y} rx={CARD.w / 2 + 20} ry={CARD.h / 2 + 16} />

        {/* Un clic: el cursor viaja en coordenadas del mundo y la onda sale en cada cuadro de `clicks`. */}
        <Cursor show={[20, 100]} keys={[[20, 1500, 880], [T.click - 2, target.x + 60, target.y + 50]]} clicks={[T.click]} />
      </World>

      {/* Fuera del mundo: no se mueve con la cámara. Se aparta cuando la escala pasa de 1. */}
      <DockedHeadline index={1} title={title} subtitle={subtitle ? typed(subtitle, f, 6, 0.8) : undefined} start={4} hide={hideFromScale(cam.scale)} />
      <Wash range={T.wash} />
    </>
  );
}

/** Escena sola (para verla y renderizarla por separado): `Stage` + contenido. */
export function Scene(props: SceneProps) {
  return (
    <Stage clouds={false}>
      <SceneBody {...props} />
    </Stage>
  );
}

/** Video de la escena sola: agrega el tema. Lo registra `index.ts`. */
export const SceneVideo: React.FC<Partial<SceneProps>> = ({ title = "Título de la escena", subtitle }) => (
  <ThemeProvider theme={videoTheme}>
    <Scene title={title} subtitle={subtitle} />
  </ThemeProvider>
);
