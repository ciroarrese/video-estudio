import type React from "react";
import { Easing, useFrame, useVideoConfig } from "../engine";
import { Wash, World, kf, useCameraAt, zoomThrough } from "../kit";
import { entrance, staggerFrames, staggerOverride, surfaceStyle, textStyle, useTheme } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import { fitText, listLayout, openingWall, rigTransform } from "./layout";
import { Chip, HeadlineRow, HighlightedTitle, StoryStage, rowEntrance, scaler, useEase, useStorySpec } from "./shared";
import { TopicContext, TopicHeadline, headlineDefaults } from "./topic";
import { wallOptions } from "./types";
import type { StorySpec } from "./types";

import { OPENING_FRAMES } from "./durations";
export { OPENING_FRAMES };
export const openingFrames = (spec: StorySpec) => spec.timing?.opening ?? OPENING_FRAMES;

const WALL_P = 1400;

/** Cuadros que dura el acople final del titular (`design.handoff: "dock"`) antes de terminar la apertura. */
const DOCK_FRAMES = 26;

/**
 * Apertura: el título se lee desde el primer cuadro sobre un muro de etiquetas en profundidad (cada pieza con su
 * perspectiva, inclinación y desenfoque por distancia, con un avance lento de cámara); el muro se enciende de a una.
 * A los ~2.5 s el título se va, entra la lista numerada (lo más grande de la pantalla) y se atraviesa el primer titular.
 *
 * Se usa suelta (`<Opening spec />` dentro de un `Sequence` de `openingFrames(spec)` cuadros) o la arma `composeStory`.
 * `first` es el índice del tema que se atraviesa (o se acopla) al final: el primero que tiene escena (0 por defecto). `dock`
 * pisa a `spec.design.handoff`: con `true` la apertura no termina en un velo sino con el titular de ese tema acoplado arriba a
 * la izquierda (la píldora de `TopicHeadline`, la misma con el mismo diseño y tamaño que dibuja la escena), y las nubes llegan al último
 * cuadro en el punto donde arrancan en la escena. `through` (pisa a `design.handoff: "through"`): se atraviesa el titular como en el velo
 * pero sin velo y con las nubes continuas; la escena entra sobre el fondo.
 */
export function Opening({ spec: specIn, first = 0, dock, through }: { spec: StorySpec; first?: number; dock?: boolean; through?: boolean }) {
  const theme = useTheme();
  const spec = useStorySpec(specIn); // el diseño del video sobre el del design system
  const ease = useEase();
  const f = useFrame();
  const { width, height } = useVideoConfig();
  const dur = openingFrames(spec);
  const u = scaler(dur, OPENING_FRAMES);
  const n = spec.topics.length;
  const L = listLayout(spec, theme, width, height);
  const wall = openingWall(spec, height, width);
  const cx = width / 2, cy = height / 2;

  const design = spec.design ?? {};
  const docking = dock ?? (through ? false : design.handoff === "dock");
  const flying = !docking && (through ?? (dock === undefined && design.handoff === "through"));
  const wo = wallOptions(design);
  const wallBlur = wo.blurOpening;
  const target = Math.min(Math.max(0, first), n - 1);
  const gap = Math.min(16, 64 / n) * (dur / OPENING_FRAMES);
  // con acople la lista se queda hasta DOCK_FRAMES antes del final (la píldora termina de entrar en el último cuadro menos 8)
  const dockAt = Math.max(Math.round(u(120)), dur - DOCK_FRAMES);
  // demora de cada titular: el paso propio lo escala el tema (`motion.stagger`); si el design system fija el de la lista (`motion.staggerList`), son esos cuadros
  const heads = (i: number) => staggerFrames(theme, i, { base: gap, context: "list", scale: dur / OPENING_FRAMES });
  // cuadros que tarda cada pieza del muro en aparecer respecto de la anterior (0,5 de siempre; `motion.staggerChips` lo cambia)
  const chipStep = staggerOverride(theme, "chips") ?? 0.5;
  const T = { titleOut: [u(78), u(100)] as [number, number], wallOff: [u(94), u(126)] as [number, number], heads: u(104), fly: (docking ? [dockAt, dockAt + 1] : flying ? [u(246), u(292)] : [u(236), u(282)]) as [number, number] };
  const underStart = T.heads + heads(n - 1) + u(20);

  // muro: avance lento de cámara con inclinación; al irse la lista se aleja
  const dolly = kf(f, [0, u(130)], [0, 240 + wo.dolly], Easing.linear);
  const ry = kf(f, [0, u(130)], [-11, 6], Easing.linear);
  const rx = kf(f, [0, u(130)], [7, -3], Easing.linear);
  const wallFade = kf(f, T.wallOff, [1, 0.05]);
  const wallBack = kf(f, [T.wallOff[0], T.wallOff[1] + u(20)], [0, -900]);
  const rig = { dz: dolly + wallBack, rx, ry };

  // título: legible desde el cuadro 0 (solo se asienta con una escala corta)
  const titleIn = kf(f, [0, u(16)], [0, 1], ease.out);
  const titleOut = kf(f, T.titleOut, [0, 1]);
  // en formatos angostos el título baja a más renglones y el cartel se queda dentro del ancho seguro
  const narrow = width / height < 1.3;
  const titleW = Math.min(1560, width - 2 * theme.safe.x);
  const tf = fitText(spec.title.text, titleW, theme.type.hero, { min: theme.type.hero * (narrow ? 0.45 : 0.5), lines: narrow ? 3 : 2, avg: 0.55 });

  // atravesado del primer titular
  const cam = useCameraAt(f, [{ f: 0, x: cx, y: cy, scale: 1 }], {
    map: (fr, c) => (docking ? c : zoomThrough(fr, T.fly, c, L.target(target), 60)),
    noBlurFrom: T.fly[0],
  });
  const othersOut = kf(f, [T.fly[0] - u(6), T.fly[0] + (docking ? 12 : u(14))], [1, 0]);
  // con acople el titular elegido se desvanece subiendo hacia la esquina donde aparece la píldora
  const dockOut = kf(f, [T.fly[0] - 2, T.fly[0] + 16], [0, 1]);

  return (
    <StoryStage frame={docking || flying ? f - dur : f} cloud={design.clouds}>
      <div key={wallFade >= 0.9995 ? "on" : "fade"} style={{ position: "absolute", inset: 0, zIndex: 0, opacity: fade(wallFade) }}>
        {wall.map((c, i) => {
          const lit = kf(f, [u(c.on), u(c.on) + 3], [0, 1], Easing.linear);
          const pop = kf(f, [u(c.on), u(c.on) + 5, u(c.on) + 22], [0, 1, 0]);
          const appear = kf(f, [u(i * chipStep), u(10 + i * chipStep)], [0.5, 1], ease.out);
          const blur = wallBlur ? Math.round(Math.min(2.5, Math.max(0, (60 - (c.z + rig.dz)) / 160)) * 10) / 10 : 0;
          const chip: React.CSSProperties = { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(c.x, c.y, c.z, rig, WALL_P, cx, cy, `${c.k === 1 ? "" : ` scale(${c.k})`} translate(-50%, -50%)`), zIndex: 1000 + c.z, opacity: fade(appear), filter: blur > 0 ? `blur(${blur}px)` : undefined };
          return (
            // Muro de fondo: adorno (`data-qa-decor`: sin min-size ni contraste, son detalle que se lee al acercar; sí se juzgan recorte y choque con el
            // título y las filas). Las fichas pasan por detrás del cartel (`covered`; su texto queda bajo el del cartel: `overlap`) y llegan hasta los bordes del cuadro (`safe-area`) a propósito.
            <div key={`${i}-${styleKey(chip)}`} data-qa-decor="" data-qa-ignore="covered overlap safe-area" style={chip}>
              <Chip text={c.text} lit={lit} pop={pop} />
            </div>
          );
        })}
      </div>

      {titleOut < 1 && (() => {
        // el cartel solo lleva `transform` / `opacity` mientras se anima: en reposo un `translateY(0px) scale(1)` residual lo compone en
        // capa propia y su texto se rasteriza distinto según el historial de cuadros
        // superficie, borde, sombra y radio del cartel según el design system (`surfaceStyle`); `design.titleCard` del video pisa al del tema
        const surf = surfaceStyle(theme, "title", { titleCard: design.titleCard === "glass" ? "glass" : "solid" });
        // la entrada del cartel (`motion.entrance`) es solo un asentado de movimiento: el título se lee desde el primer cuadro, así que
        // el progreso arranca en 0,8 (con la entrada por defecto: escala de 0,95 a 1) y no lleva fundido
        const enter = entrance(theme, 0.8 + 0.2 * titleIn, 0, { native: "scale", from: 0.75 });
        const exit = xform({ y: Math.round(-titleOut * 120), scale: 1 - titleOut * 0.1 });
        const transform = [enter.transform, exit].filter(Boolean).join(" ") || undefined;
        const tt = textStyle(theme, "title", { tracking: -0.03 });
        const card: React.CSSProperties = {
          maxWidth: Math.min(1700, width - theme.safe.x),
          boxSizing: "border-box",
          padding: `${Math.round(tf.size * 0.3)}px ${Math.round(tf.size * 0.55)}px`,
          ...surf,
          opacity: fade(1 - titleOut),
          transform,
          textAlign: "center",
          fontSize: tf.size,
          fontWeight: tt.fontWeight,
          color: theme.color.text,
          letterSpacing: tt.letterSpacing,
          lineHeight: 1.08,
        };
        return (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 3 }}>
            <div key={styleKey(card)} style={card}>
              <HighlightedTitle text={tf.text} highlight={spec.title.highlight} loop={design.gradient?.loop} progress={kf(f, [u(10), u(46)], [0, 1], ease.out)} />
            </div>
          </div>
        );
      })()}

      <World camera={cam} width={width} height={height}>
        {spec.topics.map((_, i) => {
          const s = T.heads + heads(i);
          const a = kf(f, [s, s + u(24)], [1e-6, 1], ease.out);
          const isTarget = i === target;
          const opacity = isTarget ? (docking ? 1 - dockOut : kf(f, [T.fly[1] - u(6), T.fly[1]], [1, 0])) : othersOut;
          if (f < s) return null;
          // con acople el titular elegido sube un poco hacia la esquina al irse; en el resto el desplazamiento es el de la entrada
          const dy = docking && isTarget ? Math.round(-dockOut * 40) : 0;
          return (
            <HeadlineRow
              key={i}
              i={i}
              L={L}
              opacity={a * opacity}
              gradientLoop={design.gradient?.loop}
              underline={isTarget ? kf(f, [underStart, underStart + u(28)], [0, 1], ease.out) : 0}
              style={{ ...rowEntrance(theme, a, i, { distance: 80, dy, depth: 700 }), filter: a < 0.98 ? `blur(${((1 - a) * 8).toFixed(1)}px)` : undefined }}
            />
          );
        })}
      </World>

      {docking ? (
        // la píldora que sigue en la escena: el MISMO componente y las mismas props (tema, diseño y tamaño de la historia), así que el último
        // cuadro de la apertura y el primero de la escena son idénticos en esa zona; termina de entrar en el último cuadro menos 8
        <TopicContext.Provider value={{ index: target, name: spec.topics[target]!.name, line: spec.topics[target]!.line, headline: headlineDefaults(spec) }}>
          <TopicHeadline start={T.fly[0]} />
        </TopicContext.Provider>
      ) : flying ? null : (
        <Wash range={[T.fly[1] - u(16), T.fly[1] - u(2)]} />
      )}
    </StoryStage>
  );
}
