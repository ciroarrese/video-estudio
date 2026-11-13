import { Easing, useFrame, useVideoConfig } from "../engine";
import { kf } from "../kit";
import { useTheme } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import type React from "react";
import { INTERLUDE_COMPACT_FRAMES } from "./durations";
import { fitText } from "./layout";
import { nextTopic } from "./Interlude";
import { CheckMark, StoryStage, scaler, useEase } from "./shared";
import type { StorySpec } from "./types";

export { INTERLUDE_COMPACT_FRAMES };
export const interludeCompactFrames = (spec: StorySpec) => spec.timing?.interludeCompact ?? INTERLUDE_COMPACT_FRAMES;

/**
 * Vuelta al listado compacta (`interludes: "compact"`): una tira de progreso (un segmento por tema), el tema que se acaba de ver con
 * su tilde y, debajo, el que sigue. No repite la lista entera: dura 40 cuadros por defecto (mínimo 24) en vez de 120.
 * `done` = cuántos temas ya se mostraron (1..n); sin siguiente (último tema, o ninguno más con escena) dice que sigue el resumen.
 * `skip` (índices de temas sin escena) los saca de la tira y del "Sigue"; `next` fuerza el siguiente (-1: ninguno).
 */
export function InterludeCompact({ spec, done, skip = [], next: nextProp }: { spec: StorySpec; done: number; skip?: number[]; next?: number }) {
  const theme = useTheme();
  const ease = useEase();
  const f = useFrame();
  const { width } = useVideoConfig();
  const dur = interludeCompactFrames(spec);
  const u = scaler(dur, INTERLUDE_COMPACT_FRAMES);
  const n = spec.topics.length;
  const last = spec.topics[done - 1]!;
  const nextIdx = nextProp ?? nextTopic(n, done, skip);
  const next = nextIdx >= 0 ? spec.topics[nextIdx]! : null;
  // la tira cuenta solo los temas que se muestran (con escena): `shown` son sus índices y `pos` el lugar del que acaba de verse
  const shown = spec.topics.map((_, i) => i).filter((i) => !skip.includes(i));
  const pos = shown.indexOf(done - 1);
  const m = shown.length;
  const maxW = width - 2 * theme.safe.x;
  const barW = Math.min(maxW, 900);
  const gap = 12;
  const segW = (barW - gap * (m - 1)) / m;

  const appear = kf(f, [0, u(8)], [0, 1], ease.out);
  const out = 1 - kf(f, [dur - u(7), dur], [0, 1], Easing.linear);
  const fill = kf(f, [u(4), u(16)], [0, 1], ease.inOut); // el segmento del tema recién visto se llena
  const check = kf(f, [u(6), u(18)], [0, 1], Easing.linear);
  const nextIn = kf(f, [u(14), u(26)], [0, 1], ease.out);

  const nameFit = fitText(last.name, maxW - theme.type.h2 * 1.4, theme.type.h2, { min: theme.type.body, avg: 0.55 });
  const nextFit = next ? fitText(next.name, maxW, theme.type.h2 * 0.62, { min: theme.type.body * 0.8, avg: 0.55 }) : null;
  const cs = Math.round(theme.type.h2 * 0.95);

  // propiedades que se emiten solo mientras se animan (React agrega al final las que reaparecen): la clave remonta el elemento al cambiar el conjunto
  const col: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(theme.type.h2 * 0.55), opacity: fade(out) };
  const strip: React.CSSProperties = { display: "flex", gap, width: barW, opacity: fade(appear) };
  const nameRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: Math.round(cs * 0.4), maxWidth: maxW, opacity: fade(appear), transform: xform({ y: Math.round((1 - appear) * 18) }) };
  const nextBox: React.CSSProperties = { textAlign: "center", opacity: fade(nextIn), transform: xform({ y: Math.round((1 - nextIn) * 14) }), color: theme.color.textMuted, fontSize: theme.type.body };

  return (
    <StoryStage frame={f} cloud={spec.design?.clouds}>
      <div key={styleKey(col)} style={col}>
        <div key={`strip-${styleKey(strip)}`} style={strip}>
          {shown.map((_, i) => {
            const p = i < pos ? 1 : i === pos ? fill : 0;
            return (
              <div key={i} style={{ flex: 1, height: 10, borderRadius: theme.radius.pill, background: theme.color.border, overflow: "hidden", width: segW }}>
                <div style={{ width: `${(p * 100).toFixed(2)}%`, height: "100%", background: theme.gradient.brand }} />
              </div>
            );
          })}
        </div>
        <div key={`name-${styleKey(nameRow)}`} style={nameRow}>
          <div style={{ flexShrink: 0, width: cs, height: cs }}>{check > 0 && <CheckMark p={check} size={cs} id={`c${done}`} />}</div>
          <div style={{ fontSize: nameFit.size, fontWeight: theme.font.weights.semibold, color: theme.color.text, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{nameFit.text}</div>
        </div>
        <div key={`next-${styleKey(nextBox)}`} style={nextBox}>
          {nextFit ? (
            <>
              <div style={{ fontSize: theme.type.caption * 0.9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: theme.font.weights.medium }}>{`Sigue · ${pos + 2} de ${m}`}</div>
              <div style={{ fontSize: nextFit.size, color: theme.color.text, fontWeight: theme.font.weights.medium, marginTop: 6, whiteSpace: "nowrap" }}>{nextFit.text}</div>
            </>
          ) : (
            <div style={{ fontSize: theme.type.eyebrow * 1.3, fontWeight: theme.font.weights.medium }}>Sigue el resumen</div>
          )}
        </div>
      </div>
    </StoryStage>
  );
}
