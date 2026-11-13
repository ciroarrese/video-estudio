import React from "react";
import { random } from "../../engine";
import { progress, roleColor, stagger, styleKey, useFx, xform } from "../core";
import type { ColorRole } from "../core";
import { staggerFrames, textLook } from "../../themes";
import { mix } from "../core";
import type { TextFxProps } from "./shared";
import { baseText } from "./shared";

export type SplitFlapProps = TextFxProps & {
  tileColor?: ColorRole;
  /** Alfabeto por el que pasan las losetas antes de llegar a la letra final. */
  glyphs?: string;
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type FlapPlan = { delay: number; seq: string[]; flipDur: number };

/** Plan de una loseta: demora, secuencia de glifos (el ultimo es la letra final) y cuadros por giro. Cantidad de giros sembrada (2 a 5). */
export function flapPlan(ch: string, i: number, n: number, seed: string | number, duration: number, glyphs = GLYPHS, each = 2): FlapPlan {
  const maxFlips = 5;
  const flips = ch === " " ? 0 : 2 + Math.floor(random(`${seed}:n:${i}`) * (maxFlips - 1));
  const flipDur = Math.max(2, Math.floor((duration - (n - 1) * each) / maxFlips));
  const g = Array.from(glyphs);
  const seq: string[] = [];
  for (let k = 0; k < flips; k++) seq.push(g[Math.floor(random(`${seed}:g:${i}:${k}`) * g.length)]!);
  seq.push(ch);
  return { delay: stagger(i, { each }), seq, flipDur };
}

/** Duracion natural (cuadros) de un tablero de `n` losetas (`each`: demora entre losetas, 2 por defecto). */
export const splitFlapDuration = (n: number, each = 2) => (n - 1) * each + 5 * 4;

/** Contorno de media loseta: lados y borde exterior, sin la línea del centro (así el glifo se lee entero). */
const ringShadow = (c: string, half: "top" | "bottom", t: number) => `inset ${t}px 0 0 ${c}, inset ${-t}px 0 0 ${c}, inset 0 ${half === "top" ? t : -t}px 0 ${c}`;

function Half({ ch, half, w, h, fs, color, bg, scaleY, origin, round, ring }: { ch: string; half: "top" | "bottom"; w: number; h: number; fs: number; color: string; bg: string; scaleY: number; origin: string; round: number; ring?: string }) {
  const transform = xform({ scaleY });
  const st: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: half === "top" ? 0 : h / 2,
    width: w,
    height: h / 2,
    overflow: "hidden",
    background: bg,
    // La escala (y su origen) solo se emiten mientras la mitad gira.
    transform,
    transformOrigin: transform ? origin : undefined,
    borderRadius: half === "top" ? `${h * round}px ${h * round}px 0 0` : `0 0 ${h * round}px ${h * round}px`,
    ...(ring ? { boxShadow: ringShadow(ring, half, Math.max(2, Math.round(h * 0.03))) } : {}),
  };
  return (
    <div key={styleKey(st)} data-qa-ignore="clip overlap covered" style={st}>
      <div style={{ position: "absolute", left: 0, top: half === "top" ? 0 : -h / 2, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: fs, lineHeight: 1 }}>
        {ch === " " ? " " : ch}
      </div>
    </div>
  );
}

/** Tablero de salidas: la mitad de arriba de cada glifo viejo cae y descubre el nuevo; cada loseta gira un numero sembrado de veces, escalonadas. */
export function SplitFlap(props: SplitFlapProps) {
  const { text, tileColor = "text", glyphs, seed = "flap", style } = props;
  const { local, theme } = useFx(props);
  const chars = Array.from(text.toUpperCase());
  const n = chars.length;
  const fs = props.fontSize ?? theme.type.h1;
  const h = Math.round(fs * 1.5);
  const w = Math.round(fs * 1.0);
  // Demora entre losetas: el paso propio (2 cuadros) escalado por el design system; con duración fija, no pasa de lo que deja 2 cuadros por giro.
  const scaled = staggerFrames(theme, 1, { base: 2 });
  const each = props.duration === undefined || n < 2 ? scaled : Math.min(scaled, Math.max(2, (props.duration - 10) / (n - 1)));
  const duration = props.duration ?? splitFlapDuration(n, each);
  const look = textLook(theme);
  const outline = look.tile === "outline";
  // `card`: loseta llena con bisagra (como siempre); `flat`: sin redondeo ni bisagra; `outline`: solo contorno, glifo del color de la loseta.
  const bg = outline ? roleColor(theme, "bg") : roleColor(theme, tileColor);
  const color = outline ? roleColor(theme, tileColor) : roleColor(theme, props.color ?? "bg");
  const ring = outline ? roleColor(theme, tileColor) : undefined;
  const round = look.tile === "card" ? 0.08 : 0;
  const hinge = roleColor(theme, "bg");
  const glyphSet = glyphs ?? look.glyphs;
  return (
    <div style={{ ...baseText(theme, { ...props, fontSize: fs }), display: "flex", gap: Math.round(fs * 0.12), ...style }}>
      {chars.map((ch, i) => {
        const plan = flapPlan(ch, i, n, seed, duration, glyphSet, each);
        const flips = plan.seq.length - 1;
        const t = local - plan.delay;
        const settled = flips === 0 || t >= flips * plan.flipDur;
        const waiting = !settled && t < 0;
        const k = waiting || settled ? 0 : Math.floor(t / plan.flipDur);
        const p = waiting || settled ? 0 : progress(t, k * plan.flipDur, plan.flipDur);
        const A = settled ? ch : plan.seq[k]!; // viejo
        const B = settled ? ch : waiting ? plan.seq[0]! : plan.seq[k + 1]!; // nuevo
        const upperA = waiting ? plan.seq[0]! : A;
        const upper = p < 0.5;
        return (
          <div key={i} style={{ position: "relative", width: w, height: h, fontWeight: props.weight ?? theme.font.weights.stat, ...(look.glow > 0 ? { boxShadow: `0 0 ${(fs * 0.3 * look.glow).toFixed(1)}px ${mix(roleColor(theme, tileColor), roleColor(theme, "bg"), 0.45)}` } : {}) }}>
            <Half ch={B} half="top" w={w} h={h} fs={fs} color={color} bg={bg} round={round} ring={ring} scaleY={1} origin="50% 100%" />
            <Half ch={upperA} half="bottom" w={w} h={h} fs={fs} color={color} bg={bg} round={round} ring={ring} scaleY={1} origin="50% 0%" />
            {!settled && !waiting && upper && <Half ch={A} half="top" w={w} h={h} fs={fs} color={color} bg={bg} round={round} ring={ring} scaleY={1 - p * 2} origin="50% 100%" />}
            {!settled && !waiting && !upper && <Half ch={B} half="bottom" w={w} h={h} fs={fs} color={color} bg={bg} round={round} ring={ring} scaleY={p * 2 - 1} origin="50% 0%" />}
            {look.tile === "card" && <div style={{ position: "absolute", left: 0, top: h / 2 - 1, width: w, height: 2, background: hinge }} />}
          </div>
        );
      })}
    </div>
  );
}
