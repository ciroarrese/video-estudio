import React from "react";
import { useFormat, useFrame, useVideoConfig } from "../engine";
import { contrastRatio, cornerRadius, dimmedColor, entrance, resolveStyle, surfaceStyle, themeCharacter, useTheme } from "../themes";
import type { DesignCharacter, Theme } from "../themes";
import { textWidth } from "./text";
import { paginarSubtitulo, subtituloActivo } from "./subtitulos";
import type { PaginaSubtitulo, Subtitulo } from "./subtitulos";
import type { Rect } from "./layout";

export type SubtitleStyle = "bloque" | "karaoke";

/** Cuadros (a 30 fps) que tarda la entrada según el carácter del design system (`fx/affinity.ts`): el editorial se toma su tiempo, el técnico entra seco. */
const ENTRADA: Record<DesignCharacter, number> = { "geometrico-sobrio": 6, editorial: 9, "ludico-manual": 7, "tecnico-oscuro": 5 };

const LINE_HEIGHT = 1.25;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface SubtitleBandOptions {
  /** Tamaño de letra en px (por defecto `theme.type.body`). */
  size?: number;
  /** Distancia en px entre el borde de abajo del cuadro y el pie del subtítulo (por defecto, la del formato; ver `subtitleBand`). */
  bottom?: number;
}

/** Medidas del formato: márgenes laterales, distancia al borde de abajo y tamaño de letra. En vertical deja libre la franja de abajo, donde las redes ponen su interfaz. */
function metrics(theme: Theme, fmt: { format: "horizontal" | "vertical" | "cuadrado"; width: number; height: number }, o: SubtitleBandOptions) {
  const size = o.size ?? theme.type.body;
  const marginX = Math.round(theme.safe.x);
  const bottom = Math.round(o.bottom ?? (fmt.format === "vertical" ? fmt.height * 0.26 : fmt.format === "cuadrado" ? theme.safe.y + fmt.height * 0.04 : theme.safe.y));
  const padX = Math.round(size * 0.5);
  const padY = Math.round(size * 0.28);
  return { size, marginX, bottom, padX, padY, maxText: Math.max(100, fmt.width - 2 * marginX - 2 * padX) };
}

/**
 * La franja donde viven los subtítulos (de hasta dos renglones): un `Rect` en px del cuadro. Sirve para dejar esa zona libre en la escena
 * (`placeBeside` con `avoid`, o simplemente no poner nada ahí). En vertical queda por encima de la zona de la interfaz de las redes.
 */
export function subtitleBand(theme: Theme, format: { width: number; height: number }, o: SubtitleBandOptions = {}): Rect {
  const fmt = { format: format.width > format.height ? ("horizontal" as const) : format.width < format.height ? ("vertical" as const) : ("cuadrado" as const), ...format };
  const m = metrics(theme, fmt, o);
  const h = Math.round(m.size * LINE_HEIGHT * 2 + 2 * m.padY);
  return { x: m.marginX, y: fmt.height - m.bottom - h, w: fmt.width - 2 * m.marginX, h };
}

export interface SubtitlesProps {
  /** Subtítulos en segundos (`{ desde, hasta, texto, palabras? }`): a mano, de `guion`, o leídos de un SRT/VTT con `parsearSubtitulos`. */
  cues: readonly Subtitulo[];
  /** `bloque` (por defecto): el texto sobre una superficie del tema. `karaoke`: lo mismo, con la palabra que se dice resaltada y lo que falta atenuado. */
  estilo?: SubtitleStyle;
  /** Segundos que se corre todo (por ejemplo, si el audio arranca después de la apertura). */
  offsetSec?: number;
  /** Tamaño de letra en px (por defecto `theme.type.body`; no baja de `theme.type.caption` por convención). */
  size?: number;
  /** Distancia en px al borde de abajo (por defecto la del formato). */
  bottom?: number;
  /** Cuadro a dibujar si no es el del contexto. */
  frame?: number;
}

/** Subtítulo activo del cuadro: la página, su índice y los instantes (cuadros) de entrada y salida. */
interface Vista {
  pagina: PaginaSubtitulo;
  desdeF: number;
  hastaF: number;
  /** El renglón anterior termina justo donde empieza este: no hay entrada. */
  pegadoAntes: boolean;
  /** El siguiente empieza justo donde termina este: no hay salida. */
  pegadoDespues: boolean;
}

/**
 * Subtítulos de hasta dos renglones, función pura del cuadro y de las props. Todo sale del tema: tipografía (`font.family`, peso `medium`),
 * colores (`text` sobre una superficie opaca de `surfaceStyle`), esquinas (`cornerRadius`) y entrada (`entrance`, que obedece a `style.motion.entrance`;
 * la duración sigue el carácter del design system). Cada renglón se mide con `textWidth` (sin DOM) para repartir el texto: nunca corta con "…";
 * si una frase no entra en dos renglones se parte en varias páginas, con sus tiempos sacados de las palabras.
 *
 * Posición: abajo al centro, dentro del área segura; en vertical, por encima de la franja inferior donde las redes dibujan su interfaz.
 * Es texto común del cuadro: `qa` lo juzga (tamaño, contraste, área segura). Dejá libre `subtitleBand(...)` en la escena.
 *
 * Una entrada seguida de otra sin hueco (el habla continua) cambia de golpe, sin animar; la salida se desvanece solo si sigue una pausa.
 */
export function Subtitles({ cues, estilo = "bloque", offsetSec = 0, size, bottom, frame: frameProp }: SubtitlesProps) {
  const theme = useTheme();
  const ctxFrame = useFrame();
  const frame = frameProp ?? ctxFrame;
  const { fps } = useVideoConfig();
  const fmt = useFormat();
  const m = metrics(theme, fmt, { size, bottom });
  const t = frame / fps - offsetSec;
  const idx = subtituloActivo(cues, t + 0.5 / fps);
  if (idx === null) return null;
  const cue = cues[idx]!;

  const medir = (txt: string) => textWidth(theme, txt, { size: m.size, weight: "medium" });
  const paginas = paginarSubtitulo(cue, medir, { ancho: m.maxText });
  const f = (s: number) => Math.round((s + offsetSec) * fps);
  const k = paginas.findIndex((p) => frame >= f(p.desde) && frame < f(p.hasta));
  if (k < 0) return null;
  const pag = paginas[k]!;
  const anterior = k > 0 ? paginas[k - 1]!.hasta : idx > 0 ? cues[idx - 1]!.hasta : -Infinity;
  const siguiente = k < paginas.length - 1 ? paginas[k + 1]!.desde : idx + 1 < cues.length ? cues[idx + 1]!.desde : Infinity;
  const hueco = 0.25; // pausa mínima (s) para animar entrada y salida
  const v: Vista = { pagina: pag, desdeF: f(pag.desde), hastaF: f(pag.hasta), pegadoAntes: pag.desde - anterior < hueco, pegadoDespues: siguiente - pag.hasta < hueco };

  // Entrada: la del tema (entrance) con una distancia corta; salida: opacidad en los últimos cuadros.
  const enF = Math.max(3, Math.round((ENTRADA[themeCharacter(theme)] * fps) / 30));
  const outF = Math.max(2, Math.round(enF / 2));
  const p = v.pegadoAntes ? 1 : clamp01((frame - v.desdeF + 1) / enF);
  const entra = entrance(theme, p, 0, { distance: Math.round(m.size * 0.4), depth: 160, round: true });
  const resto = v.hastaF - frame; // cuadros que le quedan (1 en el último)
  const sale = v.pegadoDespues || resto > outF ? undefined : +(resto / (outF + 1)).toFixed(3);
  const opacidad = sale !== undefined ? (entra.opacity !== undefined ? Math.min(Number(entra.opacity), sale) : sale) : entra.opacity;

  // Superficie: la del tema, siempre opaca (el texto tiene que leerse sobre cualquier escena).
  const sup = surfaceStyle(theme, "chip");
  const vidrio = resolveStyle(theme).surface.kind === "glass";
  const fondo = vidrio ? theme.color.surface : (sup.background as string);
  const renglones = pag.renglones;
  const radio = renglones.length > 1 ? cornerRadius(theme, "control") : cornerRadius(theme, "chip");

  const t0 = t + 0.5 / fps;
  const acento = [theme.color.accent, theme.color.accent2].find((c) => contrastRatio(c, fondo) >= 4.5) ?? theme.color.text;
  const pendiente = dimmedColor(theme, theme.color.text, fondo, { min: 4.5 });

  const contenido = renglones.map((r, i) =>
    estilo === "karaoke" ? (
      <div key={i}>
        {r.map((w, j) => {
          const hecha = t0 >= w.hasta - 1e-9;
          const actual = !hecha && t0 >= w.desde - 1e-9;
          const color = actual ? acento : hecha ? theme.color.text : pendiente;
          return (
            <React.Fragment key={j}>
              {j > 0 ? " " : null}
              <span style={{ color }}>{w.texto}</span>
            </React.Fragment>
          );
        })}
      </div>
    ) : (
      <div key={i}>{r.map((w) => w.texto).join(" ")}</div>
    ),
  );

  const { boxShadow, border } = sup;
  return (
    <div
      data-ve-piece="Subtitles"
      style={{ position: "absolute", left: m.marginX, right: m.marginX, bottom: m.bottom, display: "flex", justifyContent: "center", alignItems: "flex-end", pointerEvents: "none" }}
    >
      <div
        style={{
          boxSizing: "border-box",
          maxWidth: "100%",
          padding: `${m.padY}px ${m.padX}px`,
          background: fondo,
          border,
          boxShadow,
          borderRadius: radio,
          color: theme.color.text,
          fontFamily: theme.font.family,
          fontWeight: theme.font.weights.medium,
          fontSize: m.size,
          lineHeight: LINE_HEIGHT,
          textAlign: "center",
          overflowWrap: "anywhere",
          ...(entra.transform ? { transform: entra.transform } : {}),
          ...(entra.clipPath ? { clipPath: entra.clipPath } : {}),
          ...(opacidad !== undefined ? { opacity: opacidad } : {}),
        }}
      >
        {contenido}
      </div>
    </div>
  );
}
