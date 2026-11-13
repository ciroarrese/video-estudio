// Escena inicial. Se copia con: bash templates/nuevo.sh escena <slug> <nombre-de-escena>
// (queda en videos/<slug>/<nombre-de-escena>/; ver docs/guia-escenas.md).
//
// Reglas que esta plantilla ya cumple (ver docs/reglas.md):
//  - Todo sale del cuadro (`useFrame`) y del tema (`useTheme`): nada de estado, azar ni temporizadores.
//  - Coordenadas del MUNDO dentro de <World>; la cámara se mueve con cuadros clave.
//  - El titular se aparta solo cuando la cámara se acerca (`hideFromScale`).
//  - Un efecto del catálogo `fx/` (MaskedRise) para empezar desde piezas hechas; ver docs/animaciones.md.
//  - Diseño por formato (`useFormat().pick`): una disposición para horizontal y otra para vertical.
//    El mundo mide width x height del formato (no 1920x1080 a mano) y la cámara arranca en su centro.
//  - Un acercamiento rápido en la acción clave, un clic, un garabato y un atravesado final.
//  - Termina atravesando un elemento y con un velo (`Wash`) hacia la escena siguiente.
import React from "react";
import { useFormat, useFrame } from "../../engine";
import {
  Cursor, DockedHeadline, DoodleCircle, Stage, Wash, World,
  cameraAt, hideFromScale, kf, typed, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";
import { MaskedRise } from "../../fx";
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

// --- Diseño por formato, en coordenadas del mundo (1 unidad = 1 px a escala 1) ---
// El lienzo mide width x height del formato: 1920x1080 en horizontal, 1080x1920 en vertical. Dejamos libre
// la franja de arriba (y < 170 en horizontal, y < 300 en vertical) para el titular en la vista general.
// En vertical el contenido se apila y ocupa casi todo el cuadro: un diseño horizontal achicado quedaría vacío.
type Layout = {
  panel: { x: number; y: number; w: number; h: number };
  card: { w: number; h: number };
  cardPos: (i: number) => { x: number; y: number };
  rowsTop: number; // dónde empiezan las filas, relativo al panel
  rowW: number;
  cursorHome: { x: number; y: number };
  zoom: number; // acercamiento a la tarjeta elegida
  through: { x: number; y: number }; // punto que se atraviesa al final
};
const LAYOUTS: { horizontal: Layout; vertical: Layout } = {
  horizontal: {
    panel: { x: 260, y: 200, w: 1400, h: 700 },
    card: { w: 400, h: 220 },
    cardPos: (i) => ({ x: 310 + i * 450, y: 290 }),
    rowsTop: 360, rowW: 1300,
    cursorHome: { x: 1500, y: 880 },
    zoom: 1.8,
    through: { x: 260 + 1400 - 140, y: 200 + 540 },
  },
  vertical: {
    panel: { x: 60, y: 400, w: 960, h: 1120 },
    card: { w: 860, h: 220 },
    cardPos: (i) => ({ x: 110, y: 500 + i * 250 }),
    rowsTop: 880, rowW: 860,
    cursorHome: { x: 900, y: 1500 },
    zoom: 1.15, // la tarjeta ya ocupa casi todo el ancho
    through: { x: 540, y: 400 + 880 + 30 },
  },
};
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

// Cámara: vista general -> acercamiento rápido -> sostener -> atravesado final (el desenfoque se apaga en ese tramo).
const makeCamera = (f: number, L: Layout, cx: number, cy: number) => {
  const c = { x: L.cardPos(PICK).x + L.card.w / 2, y: L.cardPos(PICK).y + L.card.h / 2 };
  const keys: CameraKey[] = [
    { f: 0, x: cx, y: cy, scale: 1 },
    { f: T.zoom, x: c.x, y: c.y, scale: L.zoom },
    { f: 110, x: c.x, y: c.y, scale: L.zoom },
  ];
  return cameraAt(f, keys, {
    map: (fr, cam) => zoomThrough(fr, T.through, cam, L.through, 40),
    noBlurFrom: T.through[0],
  });
};

/** Contenido de la escena SIN `Stage`: es lo que usa la historia (que ya trae su propio `Stage`). */
export function SceneBody({ title, subtitle }: SceneProps) {
  const f = useFrame();
  const t = useTheme();
  const { width, height, pick } = useFormat();
  const L = pick(LAYOUTS); // cuadrado cae en horizontal: si lo habilitás, agregale su diseño
  const { panel: PANEL, card: CARD } = L;
  const cam = makeCamera(f, L, width / 2, height / 2);
  const picked = f >= T.click;
  const target = { x: L.cardPos(PICK).x + CARD.w / 2, y: L.cardPos(PICK).y + CARD.h / 2 };

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
          {/* Efecto del catálogo (docs/animaciones.md): el rótulo sube desde una máscara. Probá también BarsGrow o DigitRoll. */}
          <div style={{ padding: "22px 50px" }}>
            <MaskedRise text="Panel de ejemplo" start={6} fontSize={t.type.body} by="word" />
          </div>
        </div>

        {[0, 1, 2].map((i) => {
          const a = kf(f, [8 + i * 6, 26 + i * 6], [0, 1]); // entrada escalonada
          const sel = i === PICK && picked;
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: L.cardPos(i).x, top: L.cardPos(i).y + (1 - a) * 30,
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
              position: "absolute", left: PANEL.x + 50, top: PANEL.y + L.rowsTop + i * 76, width: L.rowW, height: 58,
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
        <Cursor show={[20, 100]} keys={[[20, L.cursorHome.x, L.cursorHome.y], [T.click - 2, target.x + 60, target.y + 50]]} clicks={[T.click]} />
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
