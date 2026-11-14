// Escena inicial. Se copia con: bash templates/nuevo.sh escena <slug> <nombre-de-escena>
// (queda en videos/<slug>/<nombre-de-escena>/; ver docs/guia-escenas.md).
//
// Reglas que esta plantilla ya cumple (ver docs/reglas.md):
//  - Todo sale del cuadro (`useFrame`) y del tema (`useTheme`): nada de estado, azar ni temporizadores.
//  - Coordenadas del MUNDO dentro de <World>; la cámara se mueve con cuadros clave.
//  - El titular se aparta solo cuando la cámara se acerca (`hideFromScale`).
//  - Un efecto del catálogo `fx/` (MaskedRise) para empezar desde piezas hechas; ver docs/animaciones.md.
//  - El design system decide la estética: esquinas, bordes, superficies, rótulos, entradas y cámara salen de las ayudas de
//    `themes/` (`surfaceStyle` con sus roles y opciones, `borderWidth`, `entrance`, `staggerFrames`; también `cornerRadius`, `textStyle`, `chartStyle`) y de las piezas del kit
//    (`Eyebrow`, `useCameraAt`, y `Highlight` / `Numeral` para palabras y cifras destacadas). La escena no pone radios, sombras, pesos ni curvas propios: cambiar el tema cambia el video.
//  - Diseño por formato (`useFormat().pick`): una disposición para horizontal y otra para vertical.
//    El mundo mide width x height del formato (no 1920x1080 a mano) y la cámara arranca en su centro.
//  - Un acercamiento rápido en la acción clave, un clic, un garabato y un atravesado final.
//  - Termina atravesando un elemento y con un velo (`Wash`) hacia la escena siguiente.
import React from "react";
import { useFormat, useFrame } from "../../engine";
import {
  Cursor, DockedHeadline, DoodleCircle, Eyebrow, Stage, Wash, World,
  hideFromScale, kf, useCameraAt, zoomThrough,
} from "../../kit";
import type { CameraKey } from "../../kit";
import { MaskedRise } from "../../fx";
import { ThemeProvider, borderWidth, dark, editorial, entrance, neon, neutral, papel, staggerFrames, surfaceStyle, useTheme } from "../../themes";
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
// El lienzo mide width x height del formato: 1920x1080 en horizontal, 1080x1920 en vertical (receta completa en
// docs/guia-escenas.md, sección "Composición"). Margen seguro = theme.safe / 2 por lado (70 px a los costados y 55 arriba con
// el tema neutro): ningún texto va más cerca del borde. El titular fijo ocupa la franja de arriba (hasta y = 145): la
// ventana empieza debajo (200 en horizontal, 260 en vertical). En vertical el contenido se apila y llena el cuadro: un
// diseño horizontal achicado quedaría vacío, y por eso las tarjetas son 4 en dos columnas y la letra sube de escalón.
type Layout = {
  panel: { x: number; y: number; w: number; h: number };
  card: { w: number; h: number };
  cards: { x: number; y: number }[]; // esquina de cada tarjeta
  row: { w: number; h: number };
  rows: { x: number; y: number }[]; // esquina de cada fila
  cursorHome: { x: number; y: number };
  zoom: number; // acercamiento a la tarjeta elegida
  through: { x: number; y: number }; // punto que se atraviesa al final
};
const LAYOUTS: { horizontal: Layout; vertical: Layout } = {
  horizontal: {
    panel: { x: 260, y: 200, w: 1400, h: 700 },
    card: { w: 400, h: 220 },
    cards: [0, 1, 2].map((i) => ({ x: 310 + i * 450, y: 290 })),
    row: { w: 1300, h: 58 },
    rows: [0, 1, 2].map((i) => ({ x: 310, y: 560 + i * 76 })),
    cursorHome: { x: 1500, y: 880 },
    zoom: 1.8, // tope para ver la tarjeta entera: (1920 - 2 * 70) / 400 = 4,45; 1,8 deja aire
    through: { x: 1520, y: 740 },
  },
  vertical: {
    panel: { x: 40, y: 260, w: 1000, h: 1400 },
    card: { w: 440, h: 400 },
    cards: [0, 1, 2, 3].map((i) => ({ x: 80 + (i % 2) * 480, y: 360 + Math.floor(i / 2) * 430 })),
    row: { w: 920, h: 96 },
    rows: [0, 1, 2].map((i) => ({ x: 80, y: 1250 + i * 120 })),
    cursorHome: { x: 940, y: 1580 },
    zoom: 2, // tope: (1080 - 2 * 70) / 440 = 2,13; 2 muestra la tarjeta entera con su garabato
    through: { x: 540, y: 1298 },
  },
};
const PICK = 1; // tarjeta que se destaca
const FILAS = ["Elemento alfa", "Elemento beta", "Elemento gamma"]; // contenido ficticio

// --- Línea de tiempo (cuadros) ---
// La vista general se sostiene hasta `hold` con todo el contenido ya adentro: el primer cuadro clave de cámara no se mueve
// hasta entonces, así que quien mira ve el panel completo y no uno vacío.
const T = {
  hold: 26, // termina la vista general (el contenido entra de 0 a 26)
  zoom: 52, // llega al acercamiento sobre la tarjeta elegida
  click: 76,
  doodle: 84,
  through: [114, 149] as [number, number], // atravesado final
  wash: [133, 149] as [number, number],
};

// Cámara: vista general sostenida -> acercamiento rápido -> sostener -> atravesado final (el desenfoque se apaga en ese tramo).
// `useCameraAt` aplica el desenfoque y la inclinación que decide el design system (`motion.cameraBlur`, `cameraTilt`).
const cameraKeys = (L: Layout, cx: number, cy: number): CameraKey[] => {
  const c = { x: L.cards[PICK]!.x + L.card.w / 2, y: L.cards[PICK]!.y + L.card.h / 2 };
  return [
    { f: 0, x: cx, y: cy, scale: 1 },
    { f: T.hold, x: cx, y: cy, scale: 1 },
    { f: T.zoom, x: c.x, y: c.y, scale: L.zoom },
    { f: T.through[0] - 2, x: c.x, y: c.y, scale: L.zoom },
  ];
};

/** Contenido de la escena SIN `Stage`: es lo que usa la historia (que ya trae su propio `Stage`). */
export function SceneBody({ title, subtitle }: SceneProps) {
  const f = useFrame();
  const t = useTheme();
  const { width, height, pick } = useFormat();
  const L = pick(LAYOUTS); // cuadrado cae en horizontal: si lo habilitás, agregale su diseño
  // Tamaños de letra del tema: en vertical suben un escalón (el cuadro es angosto y el sujeto tiene que leerse grande).
  const fs = pick({
    horizontal: { label: t.type.eyebrow, value: t.type.stat * 0.6, row: t.type.eyebrow },
    vertical: { label: t.type.caption, value: t.type.stat * 0.8, row: t.type.caption },
  });
  const { panel: PANEL, card: CARD } = L;
  const cam = useCameraAt(f, cameraKeys(L, width / 2, height / 2), {
    map: (fr, c) => zoomThrough(fr, T.through, c, L.through, 40),
    noBlurFrom: T.through[0],
  });
  const picked = f >= T.click;
  // Con zoom, el título, las tarjetas vecinas y las filas quedan cortados por el borde a propósito (es el encuadre: la cámara sostiene una parte de un
  // diseño más grande). Solo durante el zoom, solo `offscreen` y solo en esos elementos: la tarjeta elegida (el sujeto del zoom) NO lleva la marca, así que si
  // algún día queda cortada, `qa` lo informa. Una marca va siempre con su comentario y nunca en un contenedor más ancho que lo que justifica (docs/reglas.md).
  const framing = cam.scale > 1.05 ? "offscreen" : undefined;
  const target = { x: L.cards[PICK]!.x + CARD.w / 2, y: L.cards[PICK]!.y + CARD.h / 2 };

  return (
    <>
      <World camera={cam} width={width} height={height}>
        {/* Panel: se recrea con primitivas del tema, no con una captura. La superficie (relleno, borde, sombra, esquinas) la decide el design system. */}
        <div
          style={{
            position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h,
            ...surfaceStyle(t, "window", { level: "lg" }), opacity: kf(f, [0, 12], [0, 1]),
          }}
        >
          {/* Efecto del catálogo (docs/animaciones.md): el rótulo sube desde una máscara. Probá también BarsGrow o DigitRoll. */}
          <div data-qa-ignore={framing} style={{ padding: "22px 50px" }}>
            <MaskedRise text="Panel de ejemplo" start={4} fontSize={t.type.body} by="word" />
          </div>
        </div>

        {L.cards.map((pos, i) => {
          // entrada escalonada (el paso lo escala el tema), todas adentro antes de T.hold
          const d = staggerFrames(t, i, { base: 4 });
          const a = kf(f, [2 + d, 14 + d], [0, 1]);
          const sel = i === PICK && picked;
          // ficha: borde grueso y esquinas de panel; la elegida lleva el borde en acento (si el tema no dibuja bordes, tampoco acá)
          const card = surfaceStyle(t, "card", { level: "sm", bold: true, corner: "panel" });
          const w = borderWidth(t, "card", { bold: true });
          return (
            <div
              key={i}
              data-qa-ignore={i === PICK ? undefined : framing}
              style={{
                // `minHeight`, no `height`: con otra tipografía o letra más grande la tarjeta crece en vez de desbordar y pisar a la fila de abajo.
                position: "absolute", left: pos.x, top: pos.y,
                width: CARD.w, minHeight: CARD.h, boxSizing: "border-box", padding: 30,
                ...card, ...(sel && w > 0 ? { border: `${w}px solid ${t.color.accent}` } : {}),
                ...entrance(t, a, i, { native: "rise", distance: 30 }),
              }}
            >
              <Eyebrow size={fs.label} style={{ display: "block", lineHeight: 1.2 }}>Indicador {i + 1}</Eyebrow>
              <div style={{ fontSize: fs.value, lineHeight: 1.2, fontWeight: t.font.weights.stat, color: t.color.chart[i % t.color.chart.length] }}>
                {(i + 1) * 21}
              </div>
            </div>
          );
        })}

        {FILAS.map((r, i) => (
          <div
            key={r}
            data-qa-ignore={framing}
            style={{
              position: "absolute", left: L.rows[i]!.x, top: L.rows[i]!.y, width: L.row.w, minHeight: L.row.h,
              boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 24px",
              ...surfaceStyle(t, "card", { level: "sm", corner: "control" }),
              fontSize: fs.row, lineHeight: 1.2, color: t.color.text, opacity: kf(f, [6 + staggerFrames(t, i, { base: 4 }), 18 + staggerFrames(t, i, { base: 4 })], [0, 1]),
            }}
          >
            {r}
          </div>
        ))}

        {/* Un garabato sobre lo que importa (también en coordenadas del mundo). Cada uno lleva un `id` único. */}
        <DoodleCircle start={T.doodle} end={108} id="tpl-circle" cx={target.x} cy={target.y} rx={CARD.w / 2 + 20} ry={CARD.h / 2 + 16} />

        {/* Un clic: el cursor viaja en coordenadas del mundo y la onda sale en cada cuadro de `clicks`. */}
        <Cursor show={[T.hold - 2, 108]} keys={[[T.hold - 2, L.cursorHome.x, L.cursorHome.y], [T.click - 2, target.x + 60, target.y + 50]]} clicks={[T.click]} />
      </World>

      {/* Fuera del mundo: no se mueve con la cámara. El subtítulo entra completo con la píldora: un texto que se
          escribe (`typed`) mientras su contenedor está en fundido (entrada o `hide`) da un falso error de contraste. */}
      {/* El titular se aparta cuando la escala pasa de 1. */}
      <DockedHeadline index={1} title={title} subtitle={subtitle} start={4} hide={hideFromScale(cam.scale)} />
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

/** Design systems con nombre para probar la escena con otro: `--props '{"theme":"editorial"}'` (también "neon", "papel", "dark", "neutral"). */
const NOMBRADOS = { neutral, dark, editorial, neon, papel };

/** Video de la escena sola: agrega el tema (el del video, `videos/<slug>/theme.ts`, o el que se pida por nombre en `--props`). Lo registra `index.ts`. */
export const SceneVideo: React.FC<Partial<SceneProps> & { theme?: keyof typeof NOMBRADOS }> = ({ title = "Título de la escena", subtitle, theme }) => (
  <ThemeProvider theme={theme ? NOMBRADOS[theme] : videoTheme}>
    <Scene title={title} subtitle={subtitle} />
  </ThemeProvider>
);
