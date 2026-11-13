import { Easing, FrameCanvas } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { measureWidth } from "./measure";
import { depthLook, textLook } from "../../themes";

const SEPARATORS = { round: "•", square: "\u25AA", cross: "+" } as const;

export type TypeRingProps = FxProps & {
  text: string;
  fontSize?: number;
  /** Radio del anillo en px; por defecto un cuarto del ancho. */
  radius?: number;
  /** Inclinacion del plano del anillo (grados); mirado desde arriba. */
  tilt?: number;
  /** Vueltas que da hasta quedar quieto. */
  turns?: number;
  color?: ColorRole;
  weight?: number;
};

export type RingGlyph = { ch: string; x: number; y: number; scale: number; squeeze: number; alpha: number; z: number };

/** Proyeccion a mano (sin 3D de CSS) de las letras de un anillo: devuelve los glifos ordenados de lejos a cerca. Funcion pura para pruebas. */
export function projectRing(
  letters: string[],
  o: { cx: number; cy: number; radius: number; tilt: number; angle: number; textLen: number; widths?: number[]; /** `false` (`style.depth.fog`): las letras de atrás no se apagan de a poco (0,3 parejo) y las de frente van plenas. */ fog?: boolean },
): RingGlyph[] {
  const N = letters.length;
  const step = (Math.PI * 2) / N;
  // Posicion (en px de avance) del centro de cada letra; sin `widths` todas ocupan lo mismo.
  const w = o.widths ?? letters.map(() => 1);
  const pos: number[] = [];
  let acc = 0;
  for (let i = 0; i < N; i++) { pos.push(acc + w[i]! / 2); acc += w[i]!; }
  const total = acc;
  const mid = (pos[0]! - w[0]! / 2 + pos[o.textLen - 1]! + w[o.textLen - 1]! / 2) / 2;
  const phi = (o.tilt * Math.PI) / 180;
  const persp = o.radius * 3.2;
  const out: RingGlyph[] = letters.map((ch, i) => {
    const th = o.widths ? o.angle + ((pos[i]! - mid) / total) * Math.PI * 2 : o.angle + (i - (o.textLen - 1) / 2) * step;
    const z = Math.cos(th) * o.radius;
    const sc = persp / (persp - z);
    const facing = Math.cos(th);
    return {
      ch,
      x: o.cx + Math.sin(th) * o.radius * sc,
      y: o.cy + z * Math.sin(phi) * sc,
      scale: sc,
      squeeze: facing,
      alpha: o.fog === false ? (facing >= 0 ? 1 : 0.3) : facing >= 0 ? 0.6 + 0.4 * facing : 0.16,
      z,
    };
  });
  return out.sort((a, b) => a.z - b.z);
}

/** Texto en un anillo 3D que gira y se asienta con la frase al frente. Atras: letras espejadas, achatadas por su angulo y a ~16 % de opacidad. Se dibuja en `FrameCanvas`, pintando de lejos a cerca. */
export function TypeRing(props: TypeRingProps) {
  const { text, tilt = 16, turns = 1, style } = props;
  const { local, theme } = useFx(props);
  const box = fxBox(props, { width: 1600, height: 640 });
  const fs = props.fontSize ?? theme.type.h2;
  const radius = props.radius ?? box.width / 4;
  const duration = props.duration ?? 75;
  const weight = props.weight ?? theme.font.weights.stat;
  const family = theme.font.family;
  const look = textLook(theme);
  const fog = depthLook(theme).fog;
  const sep = `  ${SEPARATORS[look.dotShape]}  `;
  const pattern = Array.from(text + sep);
  const patW = measureWidth(text + sep, fs, { family, weight });
  const reps = Math.max(1, Math.round((2 * Math.PI * radius) / (patW * 1.1)));
  const letters = Array.from({ length: reps * pattern.length }, (_, i) => pattern[i % pattern.length]!);
  const widths = letters.map((ch) => measureWidth(ch, fs, { family, weight }));
  const col = roleColor(theme, props.color ?? "text");
  const angle = (1 - Easing.out(progress(local, 0, duration))) * Math.PI * 2 * turns;

  return (
    <FrameCanvas
      width={box.width}
      height={box.height}
      style={style}
      draw={(ctx, _f, { width, height }) => {
        const glyphs = projectRing(letters, { cx: width / 2, cy: height / 2, radius, tilt, angle, textLen: Array.from(text).length, widths, fog });
        ctx.font = `${weight} ${fs}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = col;
        for (const g of glyphs) {
          if (g.ch === " ") continue;
          ctx.save();
          ctx.globalAlpha = g.alpha;
          ctx.translate(g.x, g.y);
          ctx.scale(g.scale * g.squeeze, g.scale);
          if (look.glow > 0 && g.squeeze > 0.5) {
            // Halo: la misma letra más grande y muy tenue, detrás (sin shadowBlur).
            ctx.globalAlpha = g.alpha * 0.12 * look.glow;
            ctx.save();
            ctx.scale(1.12, 1.12);
            ctx.fillText(g.ch, 0, 0);
            ctx.restore();
            ctx.globalAlpha = g.alpha * 0.22 * look.glow;
            ctx.save();
            ctx.scale(1.05, 1.05);
            ctx.fillText(g.ch, 0, 0);
            ctx.restore();
            ctx.globalAlpha = g.alpha;
          }
          ctx.fillText(g.ch, 0, 0);
          ctx.restore();
        }
      }}
    />
  );
}
