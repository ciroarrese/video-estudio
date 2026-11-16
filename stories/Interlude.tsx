import { useStoryReserve } from "./subtitles";
import React from "react";
import { Easing, useFrame, useVideoConfig } from "../engine";
import { Wash, World, kf, useCameraAt, exitThrough } from "../kit";
import { cornerRadius, handoffShift, resolveStyle, settle, staggerFrames, surfaceStyle, useTheme, withAlpha } from "../themes";
import { fade, xform } from "../fx/core/math";
import { AVG_BOLD, AVG_REG, ROW_GAP, listLayout, revealThumbRect, textWidth } from "./layout";
import { DefaultThumbnail } from "./Closing";
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
/** Cuadros de referencia (a `INTERLUDE_FRAMES`) con el velo cerrado entre el atravesado y la escena que sigue: lo de siempre, que `motion.handoffHold` puede cambiar. */
export const INTERLUDE_BLANK = 18;
/** Cuánto se puede adelantar el atravesado (cuadros de referencia): hasta que empiece justo al terminar de aparecer la fila que sigue (62). */
export const INTERLUDE_SHIFT_MIN = -4;
export const INTERLUDE_T = { check: [14, 34] as [number, number], next: [40, 62] as [number, number], fly: [66, 112] as [number, number] };
/** Tiempos (cuadros de la duración por defecto, 150) de la vuelta de revelación: tilde(s) de lo anterior, entrada de la fila nueva, su número, su subrayado y su tilde. */
export const REVEAL_T = { check: [14, 34] as [number, number], enter: [48, 62] as [number, number], number: [56, 70] as [number, number], next: [74, 96] as [number, number], lateCheck: [104, 124] as [number, number] };
/** Duración de referencia (cuadros) de la revelación escenificada (`design.reveal: "stage"`); `timing.interludeReveal` la estira o la achica en proporción. */
export const REVEAL_STAGE_FRAMES = 200;
/**
 * Tiempos (cuadros de la duración de referencia, 200) de la revelación escenificada: tilde de lo anterior, filas vistas que se corren para hacer lugar,
 * entrada de la fila nueva (resorte), su número, el barrido de luz, la miniatura que aparece al costado, el subrayado, el vuelo de la miniatura hacia la
 * fila (se achica hasta el lugar del número) y la tilde con su anillo. La opción por defecto (`"fade"`) usa `REVEAL_T`.
 */
export const REVEAL_STAGE_T = { check: [14, 34] as [number, number], room: [40, 70] as [number, number], enter: [48, 80] as [number, number], number: [62, 76] as [number, number], sweep: [68, 104] as [number, number], thumbIn: [60, 80] as [number, number], next: [88, 110] as [number, number], thumbFly: [96, 132] as [number, number], lateCheck: [132, 152] as [number, number] };
/** `true` si la vuelta de revelación de esta historia es la escenificada (`design.reveal: "stage"`). */
export const isStageReveal = (spec: StorySpec) => spec.design?.reveal === "stage";
/** Duración de referencia con que se escalan los tiempos de la vuelta de revelación según su variante. */
export const revealBase = (spec: StorySpec) => (isStageReveal(spec) ? REVEAL_STAGE_FRAMES : INTERLUDE_REVEAL_FRAMES);

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
export function Interlude({ spec: specIn, done, skip = [], next: nextProp, ticks: ticksProp, thumbnail }: {
  spec: StorySpec;
  done: number;
  skip?: number[];
  next?: number;
  /**
   * Temas (índices) que ganan su tilde con pulso en esta vuelta, en orden. Por defecto solo el último visto (`done - 1`); `composeStory` pasa
   * más de uno cuando la escena anterior siguió directo a esta (`interludeBefore: false`) y su tilde quedó pendiente.
   */
  ticks?: number[];
  /** Miniatura del tema que se revela (`design.reveal: "stage"`): la de su escena o la del tema; sin ella, la tarjeta por defecto. */
  thumbnail?: React.FC;
}) {
  const theme = useTheme();
  // Un tema tardío (`reveal: "late"`) no está en la lista hasta que se lo revela: la vuelta con `done` = todos los temas es la de la revelación
  // (la fila nueva entra, se subraya como "el que sigue" y se tilda); las demás se arman sin él.
  const reveal = done > lateStart(specIn);
  const spec = useStorySpec(reveal ? specIn : withoutLate(specIn)); // el diseño del video sobre el del design system
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const reserve = useStoryReserve(); // franja de los subtítulos (0 sin ellos)
  const dur = reveal ? interludeRevealFrames(spec) : interludeFrames(spec);
  const stage = reveal && isStageReveal(spec);
  const u = scaler(dur, reveal ? revealBase(spec) : INTERLUDE_FRAMES);
  const n = spec.topics.length;
  // la lista se arma para las n filas desde el primer cuadro de la vuelta de revelación (el lugar de la fila nueva ya está, sin saltos al entrar)
  const L = listLayout(spec, theme, width, height - reserve);
  const next = reveal ? -1 : (nextProp ?? nextTopic(n, done, skip));
  const lastTick = reveal ? [...Array(n - 1).keys()].filter((i) => !skip.includes(i)).slice(-1) : [];
  const ticks = ticksProp ?? (reveal ? lastTick : undefined);
  // con nubes más opacas (las del tema o las de `design.clouds`) el fondo se oscurece y las filas atenuadas pierden contraste: se atenúan menos
  const quietDone = Math.min(1, Math.max(QUIET_DONE + Math.max(0, (spec.design?.clouds?.opacity ?? theme.cloud.opacity) - theme.cloud.opacity) * 1.2, quietOpacity(theme, spec.design?.clouds, QUIET_DONE)));

  const sc = (r: [number, number]) => [u(r[0]), u(r[1])] as [number, number];
  const R = stage ? REVEAL_STAGE_T : REVEAL_T;
  const Z: [number, number] = [0, 0];
  const flyShift = handoffShift(theme, INTERLUDE_BLANK, INTERLUDE_SHIFT_MIN);
  const flySc = sc([INTERLUDE_T.fly[0] + flyShift, INTERLUDE_T.fly[1] + flyShift]);
  const T = reveal
    ? { check: sc(R.check), next: sc(R.next), fly: flySc, enter: sc(R.enter), number: sc(R.number), lateCheck: sc(R.lateCheck) }
    : { check: sc(INTERLUDE_T.check), next: sc(INTERLUDE_T.next), fly: flySc, enter: Z, number: Z, lateCheck: Z };
  const S = stage ? { room: sc(REVEAL_STAGE_T.room), sweep: sc(REVEAL_STAGE_T.sweep), thumbIn: sc(REVEAL_STAGE_T.thumbIn), thumbFly: sc(REVEAL_STAGE_T.thumbFly) } : null;
  const motion = resolveStyle(theme).motion;
  const room = S ? kf(f, S.room, [0, 1], ease.inOut) : 0; // las filas ya vistas se corren apenas hacia arriba para hacer lugar a la nueva
  const lateI = n - 1;
  const rowTop = L.top + lateI * L.rowH;
  const rowMidY = rowTop + L.blockTop + L.nameH / 2; // centro del renglón del nombre de la fila nueva
  // extremo derecho estimado del texto de la fila nueva (solo para ubicar la miniatura en el lugar libre y acotar el barrido)
  // (la estimación por glifo medio sobra un poco: se descuenta para que la miniatura no quede diminuta)
  const textEnd = L.textW !== undefined
    ? L.left + L.numW + L.textW // formatos angostos: ancho medido del renglón más ancho
    : L.stacked
    ? L.left + 0.88 * Math.max(textWidth(L.names[lateI]!, L.nameSize, AVG_BOLD), Math.min(L.rowW, textWidth(L.lines[lateI]!, L.lineSize, AVG_REG))) // en columna, el nombre y la línea van en renglones aparte
    : L.left + L.numW + 0.88 * (textWidth(L.names[lateI]!, L.nameSize, AVG_BOLD) + (L.inline ? textWidth(` · ${L.lines[lateI]!}`, L.lineSize, AVG_REG) : textWidth(L.lines[lateI]!, L.lineSize, AVG_REG)));
  const appear = kf(f, [0, u(14)], [0, 1], ease.out);
  const nextP = kf(f, T.next, [0, 1], ease.out);
  const end = next < 0 ? kf(f, [dur - u(30), dur], [0, 1]) : 0;
  const cam = useCameraAt(f, [{ f: 0, x: width / 2, y: height / 2, scale: 1 }], {
    map: (fr, c) => (next >= 0 ? exitThrough(theme, fr, [T.fly[0], T.fly[1] - u(10)], c, L.target(next), 60) : c),
    noBlurFrom: T.fly[0],
  });
  const others = next >= 0 ? 1 - kf(f, [T.fly[0] - u(6), T.fly[0] + u(12)], [0, 1]) : 1;


  const narrowFmt = width / height < 1.3;
  // Formatos angostos (vertical y cuadrado): la miniatura se muestra grande (al menos el 30 % del ancho del cuadro) en el lugar libre más cercano a la fila nueva, sin pisar el
  // texto de la lista (`revealThumbRect`, con las cajas medidas); si no hay lugar (cuadrado con la lista llena), la lista se aparta un momento y la miniatura se muestra en el
  // centro (`spotlight`). Desde ahí vuela achicándose hasta el lugar del número.
  const nt = S && narrowFmt ? revealThumbRect(L, theme, lateI, width, height - reserve) : null;
  const spot = nt?.mode === "spotlight";

  // ---- revelación escenificada: barrido de luz sobre la fila nueva y miniatura del tema que vuela hasta el lugar del número
  const sweepP = S ? kf(f, S.sweep, [0, 1], Easing.inOut) : 0;
  const sweepW = Math.max(200, Math.min(L.rowW, textEnd - L.left + 48));
  const sweepTop = rowTop + L.blockTop - 10;
  const sweepH = L.barTop + ROW_GAP.bar + 12 - (L.blockTop - 10);
  const sweepA = -40 + sweepP * 140; // posición (% del ancho) del borde izquierdo de la franja de luz
  const sweep = S && !L.stacked && !spot && sweepP > 0 && sweepP < 1 ? (
    <div data-qa-decor="" style={{ position: "absolute", left: L.left - 14, top: sweepTop, width: sweepW + 28, height: sweepH, borderRadius: cornerRadius(theme, "chip"), pointerEvents: "none", background: `linear-gradient(100deg, transparent ${sweepA.toFixed(1)}%, ${withAlpha(theme.color.accent, 0.34)} ${(sweepA + 16).toFixed(1)}%, ${withAlpha(theme.color.accent2, 0.22)} ${(sweepA + 30).toFixed(1)}%, transparent ${(sweepA + 40).toFixed(1)}%)` }} />
  ) : null;
  const Thumb = thumbnail ?? (() => <DefaultThumbnail index={lateI} name={spec.topics[lateI]!.name} />);
  const PANEL_W = 560, PANEL_H = 340;
  const free = width - theme.safe.x - textEnd - 40; // lugar libre a la derecha del texto de la fila nueva
  // Formato ancho sin lugar a la derecha del texto: la miniatura aparece chica directamente sobre el lugar del número, crece, se queda un momento y se encoge hasta ser la tilde.
  const side = !narrowFmt && free >= 0.4 * PANEL_W; // hay lugar a la derecha del texto de la fila nueva
  const endScale = Math.round(L.numSize * 1.5) / PANEL_W;
  const tScale = nt ? nt.w / PANEL_W : side ? Math.min(0.62, free / PANEL_W) : Math.min(0.62, endScale * 1.9, Math.max(endScale * 1.3, L.numW > 0 ? (L.numW - 6) / PANEL_W : 1)); // sin pasar del ancho de la columna del número (si la hay)
  const tx1 = L.left + Math.round(L.numSize * 1.5 * 0.36), ty1 = rowTop + L.blockTop + L.numH / 2; // donde queda la tilde (centro del número)
  const tx0 = nt ? nt.x : side ? width - theme.safe.x - (PANEL_W * tScale) / 2 : L.left - Math.round(L.numSize * 1.5 * 0.14) + (PANEL_W * tScale) / 2; // sin lugar al costado: con el borde izquierdo en el de la tilde
  const ty0 = nt ? nt.y : side ? rowMidY - L.rowH * 0.42 : ty1; // en el horizontal, un poco más arriba que el renglón: ahí no hay texto a la derecha
  const tIn = S ? kf(f, S.thumbIn, [0, 1], ease.out) : 0;
  const tFly = S ? kf(f, S.thumbFly, [0, 1], ease.inOut) : 0;
  const tOut = kf(tFly, [0.7, 1], [0, 1]);
  const tPresent = S !== null && (nt !== null || !side || tScale >= 0.4) && tIn > 0 && tFly < 1;
  const rise = side || nt !== null; // entra con un leve ascenso y crece desde casi su tamaño (en vez de brotar chica sobre el número)
  const tX = tx0 + (tx1 - tx0) * tFly;
  const tY = ty0 + (ty1 - ty0) * tFly - Math.sin(Math.PI * tFly) * (side ? 70 : 0) + (rise ? (1 - tIn) * 28 : 0);
  const tSc = (tScale * (rise ? 0.86 + 0.14 * tIn : 0.35 + 0.65 * tIn)) * (1 - tFly) + endScale * tFly;
  // spotlight: mientras la miniatura se muestra en el centro la lista se aparta (opacidad 0: no se pinta ni la juzga `qa`) y vuelve cuando la miniatura empieza a volar
  const dimIn = spot && S ? kf(f, [S.thumbIn[0] - u(10), S.thumbIn[0] + u(4)], [0, 1], ease.out) : 0;
  const dimOut = spot && S ? kf(f, [S.thumbFly[0] + u(12), S.thumbFly[0] + u(28)], [0, 1], ease.out) : 0; // vuelve cuando la miniatura ya se achicó
  const listAside = dimIn * (1 - dimOut);
  const panelSurf = surfaceStyle(theme, "window");
  const panelShadow = resolveStyle(theme).surface.elevation === "shadow" ? `0 30px 60px -24px ${withAlpha(theme.color.text, 0.4)}` : panelSurf.boxShadow;
  const thumb = tPresent ? (
    // la miniatura es una vista chica de la escena: su texto es detalle, no se le pide el tamaño mínimo; al volar pasa por encima del texto de la fila (`overlap`)
    <div data-qa-ignore="min-size overlap covered" style={{ position: "absolute", left: 0, top: 0, width: PANEL_W, height: PANEL_H, transform: `translate(${(tX - PANEL_W / 2).toFixed(2)}px, ${(tY - PANEL_H / 2).toFixed(2)}px) scale(${tSc.toFixed(4)})`, borderRadius: panelSurf.borderRadius, boxShadow: panelShadow, overflow: "hidden", opacity: fade(Math.min(1, tIn * (rise ? 1 : 3)) * (1 - tOut)), zIndex: 5 }}>
      <Thumb />
    </div>
  ) : null;

  return (
    <StoryStage frame={f} cloud={spec.design?.clouds}>
      <World camera={cam} width={width} height={height}>
        <div key={fade(appear * (1 - end)) === undefined ? "on" : "fade"} style={{ position: "absolute", left: 0, top: 0, opacity: fade(appear * (1 - end)) }}>
          {sweep}
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
            const rowIn = lateRow ? kf(f, stage ? [T.enter[0], T.enter[0] + u(12)] : T.enter, [0, 1], ease.out) : kf(f, [u(stag), u(stag + 14)], [0, 1], ease.out);
            if (lateRow && rowIn <= 0) return null; // todavía no está en la lista (su lugar ya está reservado en el diseño)
            const pop = justDone ? kf(f, [win[1] - u(4), win[1] + u(2), win[1] + u(14)], [0, 1, 0]) : 0;
            // revelación escenificada: la fila nueva entra con resorte y una leve escala desde abajo; las demás se corren apenas hacia arriba
            let rowStyle = rowEntrance(theme, rowIn, i, { distance: 60, round: false });
            if (stage && lateRow) {
              const sp = kf(f, T.enter, [0, 1]);
              const q = settle(sp, Math.max(motion.overshoot, 0.05));
              if (sp < 1) rowStyle = { transform: `translateY(${((1 - q) * L.rowH * 0.6).toFixed(2)}px) scale(${(0.94 + 0.06 * q).toFixed(4)})`, transformOrigin: "0 50%" };
              else rowStyle = {};
            } else if (stage && room > 0) {
              rowStyle = { ...rowStyle, transform: [rowStyle.transform, `translateY(${(-room * L.rowH * 0.14).toFixed(2)}px)`].filter(Boolean).join(" ") };
            }
            const rowOpacity = rowIn * (flyNext ? 1 : others) * (flyNext ? 1 - kf(f, [T.fly[1] - u(16), T.fly[1] - u(10)], [0, 1]) : 1) * (1 - listAside);
            const ringP = stage && lateRow ? kf(f, [win[1] - u(2), win[1] + u(22)], [0, 1], ease.out) : 0;
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
                {stage && lateRow && ringP > 0 && ringP < 1 && (
                  // anillo que se expande desde la tilde y se desvanece (cierra el momento)
                  <span style={{ position: "absolute", left: cl - Math.round(cs * ringP * 1.1), top: ct - Math.round(cs * ringP * 1.1), width: Math.round(cs * (1 + ringP * 2.2)), height: Math.round(cs * (1 + ringP * 2.2)), boxSizing: "border-box", borderRadius: cornerRadius(theme, "chip"), border: `${Math.max(1, Math.round(5 * (1 - ringP)))}px solid ${theme.color.accent}`, opacity: +((1 - ringP) * 0.95).toFixed(3) }} />
                )}
                {!(stage && lateRow) && pop > 0 && (
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
                style={rowStyle}
              />
            );
          })}
          {thumb}
        </div>
      </World>
      {next >= 0 && <Wash range={[T.fly[1] - u(26), T.fly[1] - u(10)]} />}
    </StoryStage>
  );
}
