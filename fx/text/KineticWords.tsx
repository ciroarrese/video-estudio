import { useFx, fxBox, roleColor } from "../core";
import type { ColorRole, FxProps } from "../core";
import { MaskedRise } from "./MaskedRise";
import { fitText } from "./measure";

export type KineticWordsProps = FxProps & {
  words: string[];
  /** Pares fondo/texto (roles del tema) que se alternan por palabra. */
  pairs?: { bg: ColorRole; fg: ColorRole }[];
  weight?: number;
  /** Tope de tamano de letra (px); por defecto el doble del `hero` del tema, ajustado al ancho. */
  maxFontSize?: number;
};

const PAIRS: { bg: ColorRole; fg: ColorRole }[] = [
  { bg: "bg", fg: "text" },
  { bg: "accent", fg: "onAccent" },
  { bg: "text", fg: "bg" },
  { bg: "accent2", fg: "onAccent" },
];

/** Cantidad de cuadros por palabra por defecto. */
export const KINETIC_FRAMES_PER_WORD = 16;

/** N palabras a corte seco: cada una ocupa una porcion igual de la duracion, con fondo y color alternados, y sube con `MaskedRise`. La ultima queda en pantalla. */
export function KineticWords(props: KineticWordsProps) {
  const { words, pairs = PAIRS, weight, maxFontSize, style } = props;
  const { local, theme } = useFx(props);
  const box = fxBox(props, { width: 1920, height: 1080 });
  const n = Math.max(1, words.length);
  const duration = props.duration ?? n * KINETIC_FRAMES_PER_WORD;
  const slice = duration / n;
  const i = Math.min(n - 1, Math.max(0, Math.floor(local / slice)));
  const word = words[i] ?? "";
  const pair = pairs[i % pairs.length]!;
  const w = weight ?? theme.font.weights.stat;
  const fs = fitText(word, box.width * 0.8, { font: { family: theme.font.family, weight: w }, max: maxFontSize ?? theme.type.hero * 2, min: 24 });
  const startOfSlice = Math.round(i * slice);
  return (
    <div
      style={{
        position: "relative",
        width: box.width,
        height: box.height,
        overflow: "hidden",
        background: roleColor(theme, pair.bg),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <MaskedRise
        text={word}
        frame={local}
        start={startOfSlice}
        duration={Math.max(6, Math.round(slice * 0.6))}
        fontSize={fs}
        weight={w}
        color={pair.fg}
        align="center"
        decorate={false}
      />
    </div>
  );
}
