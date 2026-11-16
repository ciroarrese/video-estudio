import { Sequence, useFormat, useFrame } from "../../engine";
import { Eyebrow, Stage, Subtitles, Wash, kf, leerSubtitulosJson, subtitleBand } from "../../kit";
import type { SubtitleStyle } from "../../kit";
import { ThemeProvider, dark, editorial, entrance, neon, neutral, papel, staggerFrames, surfaceStyle, textStyle, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import pista from "./subtitulos.json";

/** Los subtítulos se leen del JSON de al lado: el mismo archivo se exporta a SRT y VTT con `npm run audio -- subtitulos`. */
const SUBTITULOS = leerSubtitulosJson(pista);

const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };

/** `theme`: nombre de un design system de ejemplo o un `Theme`; `estilo`: `karaoke` (por defecto) o `bloque`. */
export type SubtitulosDemoProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme; estilo?: SubtitleStyle };

/**
 * Zona de contenido: todo el cuadro dentro del área segura menos la franja de los subtítulos (que en vertical queda por encima de la
 * interfaz de las redes). Las escenas se maquetan acá adentro y nunca pisan los subtítulos.
 */
function useContenido() {
  const theme = useTheme();
  const { width, height } = useFormat();
  const banda = subtitleBand(theme, { width, height });
  const x = theme.safe.x;
  const y = theme.safe.y;
  return { x, y, w: width - 2 * x, h: banda.y - 40 - y, vertical: height > width };
}

const PASOS = [
  { n: "1", titulo: "Escribir", detalle: "El texto de cada escena" },
  { n: "2", titulo: "Alinear", detalle: "Tiempos a mano o desde un SRT" },
  { n: "3", titulo: "Exportar", detalle: "SRT y VTT junto al MP4" },
];

function Apertura() {
  const theme = useTheme();
  const frame = useFrame();
  const c = useContenido();
  return (
    <Stage>
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: c.vertical ? "flex-start" : "center", gap: 24 }}>
        <div style={{ display: "block", ...entrance(theme, kf(frame, [4, 22], [0, 1]), 0) }}>
          <Eyebrow>Demostración</Eyebrow>
        </div>
        <div style={{ ...entrance(theme, kf(frame, [10, 34], [0, 1]), 1), fontSize: c.vertical ? theme.type.h2 : theme.type.h1, lineHeight: 1.1, ...textStyle(theme, "title"), textAlign: c.vertical ? "left" : "center", color: theme.color.text }}>
          Un video que se entiende sin sonido
        </div>
      </div>
      <Wash range={[86, 99]} />
    </Stage>
  );
}

function Pasos() {
  const theme = useTheme();
  const frame = useFrame();
  const c = useContenido();
  return (
    <Stage>
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, display: "flex", flexDirection: c.vertical ? "column" : "row", justifyContent: "center", alignItems: c.vertical ? "stretch" : "center", gap: 28 }}>
        {PASOS.map((p, i) => (
          <div key={p.n} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "28px 32px", boxSizing: "border-box", ...surfaceStyle(theme, "card"), ...entrance(theme, kf(frame, [6 + staggerFrames(theme, i), 26 + staggerFrames(theme, i)], [0, 1]), i) }}>
            <div style={{ fontSize: theme.type.h2, lineHeight: 1, color: theme.color.accent, ...textStyle(theme, "title") }}>{p.n}</div>
            <div style={{ fontSize: theme.type.display.sm, lineHeight: 1.15, color: theme.color.text, ...textStyle(theme, "title") }}>{p.titulo}</div>
            <div style={{ fontSize: theme.type.caption, lineHeight: 1.25, color: theme.color.textMuted }}>{p.detalle}</div>
          </div>
        ))}
      </div>
      <Wash range={[96, 109]} />
    </Stage>
  );
}

function Cierre() {
  const theme = useTheme();
  const frame = useFrame();
  const c = useContenido();
  return (
    <Stage>
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: c.vertical ? "flex-start" : "center", gap: 16 }}>
        <div style={{ ...entrance(theme, kf(frame, [4, 28], [0, 1]), 0), fontSize: theme.type.h1, lineHeight: 1.05, color: theme.color.accent, ...textStyle(theme, "title") }}>2 renglones</div>
        <div style={{ ...entrance(theme, kf(frame, [14, 38], [0, 1]), 1), fontSize: theme.type.body, lineHeight: 1.25, color: theme.color.textMuted, textAlign: c.vertical ? "left" : "center" }}>
          como máximo, siempre dentro del área segura
        </div>
      </div>
    </Stage>
  );
}

function Escena({ estilo }: { estilo: SubtitleStyle }) {
  return (
    <>
      <Sequence from={0} durationInFrames={100} name="apertura">
        <Apertura />
      </Sequence>
      <Sequence from={100} durationInFrames={110} name="pasos">
        <Pasos />
      </Sequence>
      <Sequence from={210} durationInFrames={90} name="cierre">
        <Cierre />
      </Sequence>
      {/* Por encima de los velos: los subtítulos no se tapan al cambiar de escena. */}
      <div style={{ position: "absolute", inset: 0, zIndex: 200, pointerEvents: "none" }}>
        <Subtitles cues={SUBTITULOS} estilo={estilo} />
      </div>
    </>
  );
}

export function SubtitulosDemo({ theme = "neutral", estilo = "karaoke" }: SubtitulosDemoProps) {
  return (
    <ThemeProvider theme={typeof theme === "object" ? theme : TEMAS[theme] ?? neutral}>
      <Escena estilo={estilo} />
    </ThemeProvider>
  );
}
