import { Easing, useFrame, useVideoConfig } from "../engine";
import { Wash, World, kf, useCameraAt, zoomThrough } from "../kit";
import { cornerRadius, staggerFrames, useTheme, withAlpha } from "../themes";
import { fade, xform } from "../fx/core/math";
import { listLayout } from "./layout";
import { CheckMark, HeadlineRow, StoryNumeral, StoryStage, quietOpacity, rowEntrance, scaler, useEase, useStorySpec } from "./shared";
import type { StorySpec } from "./types";

/** Opacidad de las filas ya vistas (el resto del texto atenuado llega al contraste mínimo con ella, con las nubes del tema). */
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
export function Interlude({ spec: specIn, done, skip = [], next: nextProp }: { spec: StorySpec; done: number; skip?: number[]; next?: number }) {
  const theme = useTheme();
  const spec = useStorySpec(specIn); // el diseño del video sobre el del design system
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = interludeFrames(spec);
  const u = scaler(dur, INTERLUDE_FRAMES);
  const n = spec.topics.length;
  const L = listLayout(spec, theme, width, height);
  const next = nextProp ?? nextTopic(n, done, skip);
  // con nubes más opacas (las del tema o las de `design.clouds`) el fondo se oscurece y las filas atenuadas pierden contraste: se atenúan menos
  const quietDone = Math.min(1, Math.max(QUIET_DONE + Math.max(0, (spec.design?.clouds?.opacity ?? theme.cloud.opacity) - theme.cloud.opacity) * 1.2, quietOpacity(theme, spec.design?.clouds, QUIET_DONE)));

  const T = { check: [u(14), u(34)] as [number, number], next: [u(40), u(62)] as [number, number], fly: [u(66), u(112)] as [number, number] };
  const appear = kf(f, [0, u(14)], [0, 1], ease.out);
  const checkP = kf(f, T.check, [0, 1], Easing.linear);
  const nextP = kf(f, T.next, [0, 1], ease.out);
  const end = next < 0 ? kf(f, [dur - u(30), dur], [0, 1]) : 0;
  const cam = useCameraAt(f, [{ f: 0, x: width / 2, y: height / 2, scale: 1 }], {
    map: (fr, c) => (next >= 0 ? zoomThrough(fr, [T.fly[0], T.fly[1] - u(10)], c, L.target(next), 60) : c),
    noBlurFrom: T.fly[0],
  });
  const others = next >= 0 ? 1 - kf(f, [T.fly[0] - u(6), T.fly[0] + u(12)], [0, 1]) : 1;

  return (
    <StoryStage frame={f} cloud={spec.design?.clouds}>
      <World camera={cam} width={width} height={height}>
        <div key={fade(appear * (1 - end)) === undefined ? "on" : "fade"} style={{ position: "absolute", left: 0, top: 0, opacity: fade(appear * (1 - end)) }}>
          {spec.topics.map((_, i) => {
            // un tema sin escena (`skip`) no es "pendiente" ni "visto": se ve plano (atenuado, sin tilde) y nunca es el siguiente; con
            // `topics[i].seen` se muestra tildado desde el principio, sin pulso
            const skipped = skip.includes(i);
            const seenFromStart = skipped && spec.topics[i]!.seen === true;
            const isDone = (i < done && !skipped) || seenFromStart;
            const justDone = i === done - 1 && !skipped;
            const isNext = i === next;
            const cp = justDone ? checkP : isDone ? 1 : 0;
            // las ya vistas quedan más tenues que la próxima, pero con el contraste del texto atenuado por encima del mínimo del control de calidad
            const quiet = isDone ? quietDone + (1 - cp) * (1 - quietDone) : skipped ? quietDone : 1;
            const stag = staggerFrames(theme, i, { base: 3, context: "rows" }); // el paso entre filas lo escala el tema, o es el de `motion.staggerRows`
            const rowIn = kf(f, [u(stag), u(stag + 14)], [0, 1], ease.out);
            const pop = justDone ? kf(f, [T.check[1] - u(4), T.check[1] + u(2), T.check[1] + u(14)], [0, 1, 0]) : 0;
            const rowOpacity = rowIn * (isNext ? 1 : others) * (isNext ? 1 - kf(f, [T.fly[1] - u(16), T.fly[1] - u(10)], [0, 1]) : 1);
            const cs = Math.round(L.numSize * 1.5);
            const cl = -Math.round(cs * 0.14);
            const ct = Math.round(L.numSize * 0.5 - cs * 0.5);
            // El número (texto de acento) se apaga en el primer cuarto de la tilde, cuando el relleno de acento que la tilde dibuja encima todavía es
            // tenue (`CheckMark` entra con `2 * cp`): un número de acento a medio fundido sobre un relleno de acento ya teñido queda bajo 3:1
            const numFade = 1 - Math.min(1, cp * 4);
            const number = cp > 0 ? (
              <>
                {/* el número queda oculto (no `opacity: 0`) bajo la tilde: sigue ocupando su lugar en la línea y no cuenta como texto */}
                <span key={numFade <= 0 ? "hidden" : fade(numFade) === undefined ? "full" : "fade"} style={{ opacity: fade(numFade), visibility: numFade <= 0 ? "hidden" : undefined }}><StoryNumeral loop={spec.design?.gradient?.loop}>{String(i + 1).padStart(2, "0")}</StoryNumeral></span>
                <span style={{ position: "absolute", left: cl, top: ct, transform: xform({ scale: 1 + pop * 0.25 }) }}>
                  <CheckMark p={cp} size={cs} id={String(i)} />
                </span>
                {pop > 0 && (
                  <span style={{ position: "absolute", left: cl, top: ct, width: cs, height: cs, borderRadius: cornerRadius(theme, "chip"), boxShadow: `0 0 ${pop * 40}px ${pop * 8}px ${withAlpha(theme.color.accent, 0.55 * pop)}` }} />
                )}
                {pop > 0 && (
                  <span style={{ position: "absolute", left: cl - Math.round(cs * 0.2), top: ct - Math.round(cs * 0.2), width: Math.round(cs * 1.4), height: Math.round(cs * 1.4), borderRadius: cornerRadius(theme, "chip"), border: `3px solid ${theme.color.accent}`, transform: `scale(${0.6 + (1 - pop) * 0.8})`, opacity: pop }} />
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
                gradientLoop={spec.design?.gradient?.loop}
                underline={isNext ? nextP : 0}
                underlineOpacity={isNext ? 1 : 0}
                style={rowEntrance(theme, rowIn, i, { distance: 60, round: false })}
              />
            );
          })}
        </div>
      </World>
      {next >= 0 && <Wash range={[T.fly[1] - u(26), T.fly[1] - u(10)]} />}
    </StoryStage>
  );
}
