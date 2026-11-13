import React from "react";
import { random } from "../../engine";
import { progress, roleColor, stagger, styleKey, useFx, xform } from "../core";
import type { ColorRole } from "../core";
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
export function flapPlan(ch: string, i: number, n: number, seed: string | number, duration: number, glyphs = GLYPHS): FlapPlan {
  const each = 2;
  const maxFlips = 5;
  const flips = ch === " " ? 0 : 2 + Math.floor(random(`${seed}:n:${i}`) * (maxFlips - 1));
  const flipDur = Math.max(2, Math.floor((duration - (n - 1) * each) / maxFlips));
  const g = Array.from(glyphs);
  const seq: string[] = [];
  for (let k = 0; k < flips; k++) seq.push(g[Math.floor(random(`${seed}:g:${i}:${k}`) * g.length)]!);
  seq.push(ch);
  return { delay: stagger(i, { each }), seq, flipDur };
}

/** Duracion natural (cuadros) de un tablero de `n` losetas. */
export const splitFlapDuration = (n: number) => (n - 1) * 2 + 5 * 4;

function Half({ ch, half, w, h, fs, color, bg, scaleY, origin }: { ch: string; half: "top" | "bottom"; w: number; h: number; fs: number; color: string; bg: string; scaleY: number; origin: string }) {
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
    borderRadius: half === "top" ? `${h * 0.08}px ${h * 0.08}px 0 0` : `0 0 ${h * 0.08}px ${h * 0.08}px`,
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
  const duration = props.duration ?? splitFlapDuration(n);
  const bg = roleColor(theme, tileColor);
  const color = roleColor(theme, props.color ?? "bg");
  const hinge = roleColor(theme, "bg");
  return (
    <div style={{ ...baseText(theme, { ...props, fontSize: fs }), display: "flex", gap: Math.round(fs * 0.12), ...style }}>
      {chars.map((ch, i) => {
        const plan = flapPlan(ch, i, n, seed, duration, glyphs);
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
          <div key={i} style={{ position: "relative", width: w, height: h, fontWeight: props.weight ?? theme.font.weights.stat }}>
            <Half ch={B} half="top" w={w} h={h} fs={fs} color={color} bg={bg} scaleY={1} origin="50% 100%" />
            <Half ch={upperA} half="bottom" w={w} h={h} fs={fs} color={color} bg={bg} scaleY={1} origin="50% 0%" />
            {!settled && !waiting && upper && <Half ch={A} half="top" w={w} h={h} fs={fs} color={color} bg={bg} scaleY={1 - p * 2} origin="50% 100%" />}
            {!settled && !waiting && !upper && <Half ch={B} half="bottom" w={w} h={h} fs={fs} color={color} bg={bg} scaleY={p * 2 - 1} origin="50% 0%" />}
            <div style={{ position: "absolute", left: 0, top: h / 2 - 1, width: w, height: 2, background: hinge }} />
          </div>
        );
      })}
    </div>
  );
}
