import { Easing, useFrame, useVideoConfig } from "../engine";
import { Wash, World, kf, useCameraAt, zoomThrough } from "../kit";
import { cornerRadius, staggerFrames, useTheme, withAlpha } from "../themes";
import { fade, xform } from "../fx/core/math";
import { listLayout } from "./layout";
import { CheckMark, HeadlineRow, StoryNumeral, StoryStage, quietOpacity, rowEntrance, scaler, useEase, useStorySpec } from "./shared";
import { lateStart, withoutLate } from "./types";
import type { StorySpec } from "./types";

/** Opacidad de las filas ya vistas (el resto del texto atenuado llega al contraste mínimo con ella, con las nubes del tema). */
const QUIET_DONE = 0.75;

import { INTERLUDE_FRAMES, INTERLUDE_REVEAL_FRAMES } from "./durations";
export { INTERLUDE_FRAMES, INTERLUDE_REVEAL_FRAMES };
export const interludeFrames = (spec: StorySpec) => spec.timing?.interlude ?? INTERLUDE_FRAMES;
/** Duración de la vuelta que revela el tema tardío (`timing.interludeReveal`, mínimo 90). */
export const interludeRevealFrames = (spec: StorySpec) => spec.timing?.interludeReveal ?? INTERLUDE_REVEAL_FRAMES;

/** Tiempos (cuadros de la duración por defecto, 120) de la vuelta común: la tilde, el subrayado del que sigue y el atravesado. Los usa `storyCues`. */
export const INTERLUDE_T = { check: [14, 34] as [number, number], next: [40, 62] as [number, number], fly: [66, 112] as [number, number] };
/** Tiempos (cuadros de la duración por defecto, 150) de la vuelta de revelación: tilde(s) de lo anterior, entrada de la fila nueva, su número, su subrayado y su tilde. */
export const REVEAL_T = { check: [14, 34] as [number, number], enter: [48, 62] as [number, number], number: [56, 70] as [number, number], next: [74, 96] as [number, number], lateCheck: [104, 124] as [number, number] };
/** Cuadros que se corre cada tilde pendiente respecto de la anterior cuando una vuelta tilda varios temas a la vez (paso propio del tema: `motion.staggerRows`). */
export const TICK_STEP = 6;

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
export function Interlude({ spec: specIn, done, skip = [], next: nextProp, ticks: ticksProp }: {
  spec: StorySpec;
  done: number;
  skip?: number[];
  next?: number;
  /**
   * Temas (índices) que ganan su tilde con pulso en esta vuelta, en orden. Por defecto solo el último visto (`done - 1`); `composeStory` pasa
   * más de uno cuando la escena anterior siguió directo a esta (`interludeBefore: false`) y su tilde quedó pendiente.
   */
  ticks?: number[];
}) {
  const theme = useTheme();
  // Un tema tardío (`reveal: "late"`) no está en la lista hasta que se lo revela: la vuelta con `done` = todos los temas es la de la revelación
  // (la fila nueva entra, se subraya como "el que sigue" y se tilda); las demás se arman sin él.
  const reveal = done > lateStart(specIn);
  const spec = useStorySpec(reveal ? specIn : withoutLate(specIn)); // el diseño del video sobre el del design system
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = reveal ? interludeRevealFrames(spec) : interludeFrames(spec);
  const u = scaler(dur, reveal ? INTERLUDE_REVEAL_FRAMES : INTERLUDE_FRAMES);
  const n = spec.topics.length;
  // la lista se arma para las n filas desde el primer cuadro de la vuelta de revelación (el lugar de la fila nueva ya está, sin saltos al entrar)
  const L = listLayout(spec, theme, width, height);
  const next = reveal ? -1 : (nextProp ?? nextTopic(n, done, skip));
  const lastTick = reveal ? [...Array(n - 1).keys()].filter((i) => !skip.includes(i)).slice(-1) : [];
  const ticks = ticksProp ?? (reveal ? lastTick : undefined);
  // con nubes más opacas (las del tema o las de `design.clouds`) el fondo se oscurece y las filas atenuadas pierden contraste: se atenúan menos
  const quietDone = Math.min(1, Math.max(QUIET_DONE + Math.max(0, (spec.design?.clouds?.opacity ?? theme.cloud.opacity) - theme.cloud.opacity) * 1.2, quietOpacity(theme, spec.design?.clouds, QUIET_DONE)));

  const sc = (r: [number, number]) => [u(r[0]), u(r[1])] as [number, number];
  const T = reveal
    ? { check: sc(REVEAL_T.check), next: sc(REVEAL_T.next), fly: sc(INTERLUDE_T.fly), enter: sc(REVEAL_T.enter), number: sc(REVEAL_T.number), lateCheck: sc(REVEAL_T.lateCheck) }
    : { check: sc(INTERLUDE_T.check), next: sc(INTERLUDE_T.next), fly: sc(INTERLUDE_T.fly), enter: [0, 0] as [number, number], number: [0, 0] as [number, number], lateCheck: [0, 0] as [number, number] };
  const appear = kf(f, [0, u(14)], [0, 1], ease.out);
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
            // la fila nueva de la vuelta de revelación (el tema tardío): entra, se subraya como "el que sigue" y se tilda
            const lateRow = reveal && i === n - 1;
            const order = ticks ? ticks.indexOf(i) : i === done - 1 && !skipped && !lateRow ? 0 : -1; // lugar de su tilde entre las que se dibujan en esta vuelta
            const isDone = (i < done && !skipped) || seenFromStart || lateRow;
            const justDone = lateRow || order >= 0;
            const flyNext = i === next;
            const isNext = flyNext || lateRow;
            // varias tildes pendientes a la vez: cada una arranca TICK_STEP cuadros (paso del tema) después de la anterior
            const off = order > 0 ? u(staggerFrames(theme, order, { base: TICK_STEP, context: "rows" })) : 0;
            const win: [number, number] = lateRow ? T.lateCheck : [T.check[0] + off, T.check[1] + off];
            const cp = justDone ? kf(f, win, [0, 1], Easing.linear) : isDone ? 1 : 0;
            // las ya vistas quedan más tenues que la próxima, pero con el contraste del texto atenuado por encima del mínimo del control de calidad
            const quiet = isDone ? quietDone + (1 - cp) * (1 - quietDone) : skipped ? quietDone : 1;
            const stag = staggerFrames(theme, i, { base: 3, context: "rows" }); // el paso entre filas lo escala el tema, o es el de `motion.staggerRows`
            const rowIn = lateRow ? kf(f, T.enter, [0, 1], ease.out) : kf(f, [u(stag), u(stag + 14)], [0, 1], ease.out);
            if (lateRow && rowIn <= 0) return null; // todavía no está en la lista (su lugar ya está reservado en el diseño)
            const pop = justDone ? kf(f, [win[1] - u(4), win[1] + u(2), win[1] + u(14)], [0, 1, 0]) : 0;
            const rowOpacity = rowIn * (flyNext ? 1 : others) * (flyNext ? 1 - kf(f, [T.fly[1] - u(16), T.fly[1] - u(10)], [0, 1]) : 1);
            const cs = Math.round(L.numSize * 1.5);
            const cl = -Math.round(cs * 0.14);
            const ct = Math.round(L.numSize * 0.5 - cs * 0.5);
            // El número (texto de acento) se apaga en el primer cuarto de la tilde, cuando el relleno de acento que la tilde dibuja encima todavía es
            // tenue (`CheckMark` entra con `2 * cp`): un número de acento a medio fundido sobre un relleno de acento ya teñido queda bajo 3:1
            const numFade = 1 - Math.min(1, cp * 4);
            // el número de la fila nueva aparece un instante después de que ella entra
            const numIn = lateRow ? kf(f, T.number, [0, 1], ease.out) : 1;
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
            ) : lateRow ? (
              // visibility oculta (no `opacity: 0`) mientras el número no empezó a entrar: no se pinta ni cuenta como texto
              <span key={numIn <= 0 ? "hidden" : fade(numIn) === undefined ? "full" : "fade"} style={{ opacity: fade(numIn), visibility: numIn <= 0 ? "hidden" : undefined }}><StoryNumeral loop={spec.design?.gradient?.loop}>{String(i + 1).padStart(2, "0")}</StoryNumeral></span>
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
                underlineOpacity={lateRow ? 1 - kf(f, [win[0], win[0] + u(12)], [0, 1]) : isNext ? 1 : 0}
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
