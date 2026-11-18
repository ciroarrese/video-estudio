// Paso de un tutorial de interfaz. Se copia con: npm run nuevo -- paso <slug> <nombre>
// (queda en videos/<slug>/<nombre>/; ver docs/guia-escenas.md y kit/README.md, "Tutorial de interfaz").
//
// La escena solo declara DOS cosas: la interfaz recreada (lo que se mueve con la cámara) y una tabla de tiempos con las señales.
// Todo lo demás lo hace el marco de paso (`StepFrame`):
//  - la cámara guiada por focos (vista general -> acercamiento -> cada objetivo centrado), con el perfil `plana` (sin inclinación ni desenfoque);
//  - el foco y la etiqueta junto a lo señalado (lado y alineación decididos una sola vez, con la cámara asentada);
//  - la tarjeta de dato ampliado y la barra de progreso única;
//  - las marcas para `qa` (`data-qa-world`, `data-qa-settled`, `data-qa-target`, `data-qa-overlay`).
//
// Reglas que esta plantilla ya cumple (docs/reglas.md): todo sale del cuadro y del tema, nada de estado ni azar; la interfaz se
// recrea con piezas del kit (no con capturas) y con datos ficticios; colores, letra y radios salen de `useTheme()`.
import React from "react";
import { useFormat, useFrame } from "../../engine";
import { Button, Icon, ListRow, Stage, StepFrame, Wash } from "../../kit";
import type { Rect, StepSignal } from "../../kit";
import { ThemeProvider, borderWidth, dark, editorial, neon, neutral, papel, surfaceStyle, textStyle, useTheme } from "../../themes";
import { theme as videoTheme } from "../theme";

/** Duración del paso en cuadros (30 fps = 5 s). La historia la lee de acá. */
export const DURACION = 150;

export type PasoProps = {
  /** Número de este paso (desde 1): lo usa la barra de progreso. */
  paso: number;
  /** Cantidad de pasos del tutorial. */
  pasos: number;
};

// --- Tabla de tiempos (cuadros de ESTE paso) ---
// Cada señal empieza en `start` y dura `duration`; la cámara llega 14 cuadros después del inicio y viaja en 22 (cambialo con `arrive` y `travel`).
// Para mover algo, cambiá un número acá: la cámara, la etiqueta y la barra se recalculan solas.
const T = {
  campo: { start: 14, duration: 58, elige: 46 }, // señala el campo; en `elige` se completa
  boton: { start: 78, duration: 56 }, // señala el botón
  velo: [DURACION - 14, DURACION - 1] as [number, number], // velo hacia el paso siguiente
};

// --- Interfaz recreada, en coordenadas del mundo (1 unidad = 1 px a escala 1; el mundo mide width x height del formato) ---
const VENTANA: Rect = { x: 220, y: 130, w: 1480, h: 820 };
const CAMPO: Rect = { x: 520, y: 330, w: 760, h: 88 };
const BOTON: Rect = { x: 520, y: 560, w: 300, h: 80 };
const VALOR = "Elemento alfa"; // dato ficticio

/** La interfaz: una ventana con un menú, un campo y un botón. Reemplazala por la que querés enseñar (con su estructura y sus rótulos, sin capturas). */
function Interfaz({ valor, apretado }: { valor?: string; apretado: boolean }) {
  const t = useTheme();
  const b = borderWidth(t, "card");
  return (
    <>
      <div style={{ position: "absolute", left: VENTANA.x, top: VENTANA.y, width: VENTANA.w, height: VENTANA.h, ...surfaceStyle(t, "window", { level: "lg" }) }} />
      <div style={{ position: "absolute", left: VENTANA.x + 30, top: VENTANA.y + 110, width: 220 }}>
        <ListRow title="Inicio" size={t.type.ui.md + 2} leading={<Icon name="home" size={34} color="textMuted" />} />
        <ListRow title="Elementos" on size={t.type.ui.md + 2} leading={<Icon name="document" size={34} color="accent" />} />
      </div>
      <div style={{ position: "absolute", left: CAMPO.x, top: CAMPO.y - 86, whiteSpace: "nowrap", fontSize: t.type.ui.md + 6, lineHeight: "36px", color: t.color.text, ...textStyle(t, "title") }}>Nuevo elemento</div>
      <div style={{ position: "absolute", left: CAMPO.x, top: CAMPO.y - 38, whiteSpace: "nowrap", fontSize: t.type.ui.sm, lineHeight: "28px", color: t.color.textMuted, ...textStyle(t, "label") }}>Nombre</div>
      <div
        style={{
          position: "absolute", left: CAMPO.x, top: CAMPO.y, width: CAMPO.w, height: CAMPO.h, boxSizing: "border-box", padding: "0 28px",
          display: "flex", alignItems: "center", whiteSpace: "nowrap",
          ...surfaceStyle(t, "card", { level: "sm", corner: "control" }), ...(b > 0 ? { border: `${b}px solid ${t.color.border}` } : {}),
          fontSize: t.type.ui.md + 4, lineHeight: "36px", color: valor ? t.color.text : t.color.textMuted,
        }}
      >
        {valor ?? "Escribí un nombre"}
      </div>
      <div style={{ position: "absolute", left: BOTON.x, top: BOTON.y, width: BOTON.w, height: BOTON.h, display: "flex" }}>
        <Button size={t.type.ui.md + 4} style={{ width: "100%", justifyContent: "center" }} pressed={apretado ? 1 : 0}>Guardar</Button>
      </div>
    </>
  );
}

// --- Señales: qué se señala, cuándo y qué se escribe junto al foco ---
// `label`: etiqueta junto al foco. `card`: tarjeta de dato ampliado (rótulo + valor grande) del lado indicado. `scale`: acercamiento propio.
const SENALES: StepSignal[] = [
  { id: "campo", target: CAMPO, start: T.campo.start, duration: T.campo.duration, label: "Escribí el nombre" },
  { id: "boton", target: BOTON, start: T.boton.start, duration: T.boton.duration, label: "Guardá con este botón", card: { label: "Se crea", value: "1 elemento", side: "right" } },
];

/** Contenido del paso SIN `Stage`: es lo que usa la historia (que ya trae su propio `Stage`). */
export function SceneBody({ paso, pasos }: PasoProps) {
  const f = useFrame();
  const { width, height } = useFormat();
  return (
    <>
      <StepFrame
        overview={{ x: width / 2, y: height / 2 }} // vista general: el centro del cuadro a escala 1
        zoom={{ in: 1.6 }} // acercamiento de cada objetivo (se limita solo si el objetivo no entra en el área útil)
        step={{ index: paso - 1, count: pasos, duration: DURACION }} // barra de progreso única arriba
        signals={SENALES}
      >
        <Interfaz valor={f >= T.campo.elige ? VALOR : undefined} apretado={f >= T.boton.start + 36} />
      </StepFrame>
      <Wash range={T.velo} />
    </>
  );
}

/** Escena sola (para verla y renderizarla por separado): `Stage` + contenido. */
export function Scene(props: PasoProps) {
  return (
    <Stage clouds={false}>
      <SceneBody {...props} />
    </Stage>
  );
}

/** Design systems con nombre para probar el paso con otro: `--props '{"theme":"editorial"}'` (también "neon", "papel", "dark", "neutral"). */
const NOMBRADOS = { neutral, dark, editorial, neon, papel };

/** Video del paso solo: agrega el tema (el del video, `videos/<slug>/theme.ts`, o el que se pida por nombre en `--props`). Lo registra `index.ts`. */
export const PasoVideo: React.FC<Partial<PasoProps> & { theme?: keyof typeof NOMBRADOS }> = ({ paso = 1, pasos = 3, theme }) => (
  <ThemeProvider theme={theme ? NOMBRADOS[theme] : videoTheme}>
    <Scene paso={paso} pasos={pasos} />
  </ThemeProvider>
);
