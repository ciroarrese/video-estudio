import { Easing, useFrame, useVideoConfig } from "../engine";
import { GradientText, Wash, World, cameraAt, kf, zoomThrough } from "../kit";
import { useTheme, withAlpha } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import { listLayout } from "./layout";
import { CheckMark, HeadlineRow, StoryStage, scaler, useEase } from "./shared";
import type { StorySpec } from "./types";

/** Opacidad de las filas ya vistas (el resto del texto atenuado llega al contraste mínimo con ella). */
const QUIET_DONE = 0.75;

import { INTERLUDE_FRAMES } from "./durations";
export { INTERLUDE_FRAMES };
export const interludeFrames = (spec: StorySpec) => spec.timing?.interlude ?? INTERLUDE_FRAMES;

/**
 * Siguiente tema que tiene escena después de los `done` primeros (índice), o -1 si no queda ninguno.
 * `skip` son los índices de los temas sin escena (listados en la apertura y el cierre, salteados en el medio).
 */
export function nextTopic(n: number, done: number, skip: number[] = []): number {
  for (let i = done; i < n; i++) if (!skip.includes(i)) return i;
  return -1;
}

/**
 * Vuelta a la lista entre un tema y otro. `done` = cuántos temas ya se mostraron (1..n):
 * el último ganó su tilde con un pulso y se atenúa, el subrayado pasa al siguiente y se lo atraviesa.
 * Con `done === n` (o sin más temas con escena) no hay siguiente: quedan todos tildados y la lista se desvanece.
 * `skip` (índices de temas sin escena) los deja en la lista sin tilde y sin atravesarlos; `next` fuerza el siguiente (-1: ninguno).
 */
export function Interlude({ spec, done, skip = [], next: nextProp }: { spec: StorySpec; done: number; skip?: number[]; next?: number }) {
  const theme = useTheme();
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = interludeFrames(spec);
  const u = scaler(dur, INTERLUDE_FRAMES);
  const n = spec.topics.length;
  const L = listLayout(spec, theme, width, height);
  const next = nextProp ?? nextTopic(n, done, skip);

  const T = { check: [u(14), u(34)] as [number, number], next: [u(40), u(62)] as [number, number], fly: [u(66), u(112)] as [number, number] };
  const appear = kf(f, [0, u(14)], [0, 1], ease.out);
  const checkP = kf(f, T.check, [0, 1], Easing.linear);
  const nextP = kf(f, T.next, [0, 1], ease.out);
  const end = next < 0 ? kf(f, [dur - u(30), dur], [0, 1]) : 0;
  const cam = cameraAt(f, [{ f: 0, x: width / 2, y: height / 2, scale: 1 }], {
    map: (fr, c) => (next >= 0 ? zoomThrough(fr, [T.fly[0], T.fly[1] - u(10)], c, L.target(next), 60) : c),
    noBlurFrom: T.fly[0],
  });
  const others = next >= 0 ? 1 - kf(f, [T.fly[0] - u(6), T.fly[0] + u(12)], [0, 1]) : 1;

  return (
    <StoryStage frame={f} cloud={spec.design?.clouds}>
      <World camera={cam} width={width} height={height}>
        <div key={fade(appear * (1 - end)) === undefined ? "on" : "fade"} style={{ position: "absolute", left: 0, top: 0, opacity: fade(appear * (1 - end)) }}>
          {spec.topics.map((_, i) => {
            const isDone = i < done && !skip.includes(i);
            const justDone = i === done - 1;
            const isNext = i === next;
            const cp = justDone ? checkP : isDone ? 1 : 0;
            // las ya vistas quedan más tenues que la próxima, pero con el contraste del texto atenuado por encima del mínimo del control de calidad
            const quiet = isDone ? QUIET_DONE + (1 - cp) * (1 - QUIET_DONE) : 1;
            const rowIn = kf(f, [u(i * 3), u(i * 3 + 14)], [0, 1], ease.out);
            const pop = justDone ? kf(f, [T.check[1] - u(4), T.check[1] + u(2), T.check[1] + u(14)], [0, 1, 0]) : 0;
            const rowOpacity = rowIn * (isNext ? 1 : others) * (isNext ? 1 - kf(f, [T.fly[1] - u(16), T.fly[1] - u(10)], [0, 1]) : 1);
            const cs = Math.round(L.numSize * 1.5);
            const cl = -Math.round(cs * 0.14);
            const ct = Math.round(L.numSize * 0.5 - cs * 0.5);
            const number = cp > 0 ? (
              <>
                {cp < 1 && <span style={{ opacity: fade(1 - cp) }}><GradientText>{String(i + 1).padStart(2, "0")}</GradientText></span>}
                <span style={{ position: "absolute", left: cl, top: ct, transform: xform({ scale: 1 + pop * 0.25 }) }}>
                  <CheckMark p={cp} size={cs} id={String(i)} />
                </span>
                {pop > 0 && (
                  <span style={{ position: "absolute", left: cl, top: ct, width: cs, height: cs, borderRadius: theme.radius.pill, boxShadow: `0 0 ${pop * 40}px ${pop * 8}px ${withAlpha(theme.color.accent, 0.55 * pop)}` }} />
                )}
                {pop > 0 && (
                  <span style={{ position: "absolute", left: cl - Math.round(cs * 0.2), top: ct - Math.round(cs * 0.2), width: Math.round(cs * 1.4), height: Math.round(cs * 1.4), borderRadius: theme.radius.pill, border: `3px solid ${theme.color.accent}`, transform: `scale(${0.6 + (1 - pop) * 0.8})`, opacity: pop }} />
                )}
              </>
            ) : undefined;
            return (
              <HeadlineRow
                key={i}
                i={i}
                L={L}
                quiet={quiet}
                opacity={rowOpacity}
                number={number}
                underline={isNext ? nextP : 0}
                underlineOpacity={isNext ? 1 : 0}
                style={{ transform: xform({ x: (1 - rowIn) * 60 }) }}
              />
            );
          })}
        </div>
      </World>
      {next >= 0 && <Wash range={[T.fly[1] - u(26), T.fly[1] - u(10)]} />}
    </StoryStage>
  );
}
