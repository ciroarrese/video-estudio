import React from "react";
import { useFormat } from "../engine";
import { Subtitles, subtitleBand } from "../kit";
import type { SubtitleStyle, Subtitulo } from "../kit";
import { useTheme } from "../themes";
import type { Theme } from "../themes";

/**
 * Subtítulos de la historia (`defineStory({ subtitles })`): se dibujan con `kit/Subtitles` por encima de todo el video (apertura, temas, vueltas y cierre) y la
 * historia deja libre la franja donde viven (`subtitleBand`): la lista, el cartel de la apertura, los paneles y la firma del cierre se acomodan en el resto del cuadro.
 */
export type StorySubtitles = {
  /** Subtítulos en segundos de todo el video (`{ desde, hasta, texto, palabras? }`): a mano, de `subtitulosDeGuion` o de un SRT/VTT (`parsearSubtitulos`, `leerSubtitulosJson`). */
  cues: readonly Subtitulo[];
  /** `bloque` (por defecto) o `karaoke` (la palabra que se dice resaltada). */
  estilo?: SubtitleStyle;
  /** Segundos que se corre todo (por ejemplo, si el audio arranca después de la apertura). */
  offsetSec?: number;
  /** Tamaño de letra (por defecto `type.body`) y distancia al borde de abajo (por defecto la del formato): como en `Subtitles`. */
  size?: number;
  bottom?: number;
};

/** Aire (px) entre lo que la historia dibuja y la franja de los subtítulos. */
const GAP = 24;

/** Alto (px, desde el borde de abajo) que la historia deja libre para los subtítulos en un formato: la franja `subtitleBand` y un poco de aire. `0` sin subtítulos. */
export function subtitleReserve(theme: Theme, format: { width: number; height: number }, subtitles?: Pick<StorySubtitles, "size" | "bottom">): number {
  if (!subtitles) return 0;
  const band = subtitleBand(theme, format, { size: subtitles.size, bottom: subtitles.bottom });
  return Math.max(0, Math.round(format.height - band.y + GAP));
}

const ReserveContext = React.createContext(0);

/** Cuánto del borde de abajo (px) reserva la historia para los subtítulos en este formato (0 si no lleva). Las escenas de tema lo usan para no pisarlos. */
export const useStoryReserve = (): number => React.useContext(ReserveContext);

/** Franja de los subtítulos de la historia (px del cuadro) o `null` si no lleva: la zona que una escena de tema tiene que dejar libre. */
export function useSubtitleBand(): { x: number; y: number; w: number; h: number } | null {
  const reserve = useStoryReserve();
  const theme = useTheme();
  const { width, height } = useFormat();
  return reserve > 0 ? subtitleBand(theme, { width, height }) : null;
}

/** Envuelve la historia: da la reserva a las piezas y dibuja los subtítulos encima de todo. */
export function SubtitleLayer({ subtitles, children }: { subtitles: StorySubtitles; children: React.ReactNode }) {
  const theme = useTheme();
  const { width, height } = useFormat();
  const reserve = subtitleReserve(theme, { width, height }, subtitles);
  return (
    <ReserveContext.Provider value={reserve}>
      {children}
      <div style={{ position: "absolute", inset: 0, zIndex: 100000, pointerEvents: "none" }}>
        <Subtitles cues={subtitles.cues} estilo={subtitles.estilo} offsetSec={subtitles.offsetSec} size={subtitles.size} bottom={subtitles.bottom} />
      </div>
    </ReserveContext.Provider>
  );
}
