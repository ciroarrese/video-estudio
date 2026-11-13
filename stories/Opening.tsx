import type React from "react";
import { Easing, useFrame, useVideoConfig } from "../engine";
import { Wash, World, cameraAt, kf, zoomThrough } from "../kit";
import { useTheme, withAlpha } from "../themes";
import { fade, styleKey, xform } from "../fx/core/math";
import { fitText, listLayout, openingWall, rigTransform } from "./layout";
import { Chip, HeadlineRow, HighlightedTitle, StoryStage, scaler, useEase } from "./shared";
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
export function Opening({ spec, first = 0, dock, through }: { spec: StorySpec; first?: number; dock?: boolean; through?: boolean }) {
  const theme = useTheme();
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
  const glass = design.titleCard === "glass";
  const wallBlur = wo.blurOpening;
  const target = Math.min(Math.max(0, first), n - 1);
  const gap = Math.min(16, 64 / n) * (dur / OPENING_FRAMES);
  // con acople la lista se queda hasta DOCK_FRAMES antes del final (la píldora termina de entrar en el último cuadro menos 8)
  const dockAt = Math.max(Math.round(u(120)), dur - DOCK_FRAMES);
  const T = { titleOut: [u(78), u(100)] as [number, number], wallOff: [u(94), u(126)] as [number, number], heads: u(104), fly: (docking ? [dockAt, dockAt + 1] : flying ? [u(246), u(292)] : [u(236), u(282)]) as [number, number] };
  const underStart = T.heads + (n - 1) * gap + u(20);

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
  const cam = cameraAt(f, [{ f: 0, x: cx, y: cy, scale: 1 }], {
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
          const appear = kf(f, [u(i * 0.5), u(10 + i * 0.5)], [0.5, 1], ease.out);
          const blur = wallBlur ? Math.round(Math.min(2.5, Math.max(0, (60 - (c.z + rig.dz)) / 160)) * 10) / 10 : 0;
          const chip: React.CSSProperties = { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: rigTransform(c.x, c.y, c.z, rig, WALL_P, cx, cy, `${c.k === 1 ? "" : ` scale(${c.k})`} translate(-50%, -50%)`), zIndex: 1000 + c.z, opacity: fade(appear), filter: blur > 0 ? `blur(${blur}px)` : undefined };
          return (
            <div key={`${i}-${styleKey(chip)}`} data-qa-ignore="min-size contrast overlap covered offscreen safe-area" style={chip}>
              <Chip text={c.text} lit={lit} pop={pop} />
            </div>
          );
        })}
      </div>

      {titleOut < 1 && (() => {
        // el cartel solo lleva `transform` / `opacity` mientras se anima: en reposo un `translateY(0px) scale(1)` residual lo compone en
        // capa propia y su texto se rasteriza distinto según el historial de cuadros
        const card: React.CSSProperties = {
          maxWidth: Math.min(1700, width - theme.safe.x),
          boxSizing: "border-box",
          padding: `${Math.round(tf.size * 0.3)}px ${Math.round(tf.size * 0.55)}px`,
          borderRadius: theme.radius.lg * 2,
          // "glass": superficie semiopaca con borde fino (emulación del vidrio: `backdrop-filter` no es determinista en --check)
          background: glass ? withAlpha(theme.color.surface, 0.74) : theme.color.surface,
          border: glass ? `1px solid ${withAlpha(theme.color.surface, 0.9)}` : undefined,
          boxShadow: `0 40px 90px -30px ${withAlpha(theme.color.text, 0.35)}, ${theme.shadow.lg}`,
          opacity: fade(1 - titleOut),
          transform: xform({ y: Math.round(-titleOut * 120), scale: 0.95 + titleIn * 0.05 - titleOut * 0.1 }),
          textAlign: "center",
          fontSize: tf.size,
          fontWeight: theme.font.weights.semibold,
          color: theme.color.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
        };
        return (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 3 }}>
            <div key={styleKey(card)} style={card}>
              <HighlightedTitle text={tf.text} highlight={spec.title.highlight} loop={design.gradient?.loop} />
            </div>
          </div>
        );
      })()}

      <World camera={cam} width={width} height={height}>
        {spec.topics.map((_, i) => {
          const s = T.heads + i * gap;
          const a = kf(f, [s, s + u(24)], [1e-6, 1], ease.out);
          const isTarget = i === target;
          const opacity = isTarget ? (docking ? 1 - dockOut : kf(f, [T.fly[1] - u(6), T.fly[1]], [1, 0])) : othersOut;
          if (f < s) return null;
          // con acople el titular elegido sube un poco hacia la esquina al irse; en el resto el desplazamiento es el de la entrada
          const dx = Math.round((1 - a) * 80);
          const dy = docking && isTarget ? Math.round(-dockOut * 40) : 0;
          return (
            <HeadlineRow
              key={i}
              i={i}
              L={L}
              opacity={a * opacity}
              gradientLoop={design.gradient?.loop}
              underline={isTarget ? kf(f, [underStart, underStart + u(28)], [0, 1], ease.out) : 0}
              style={{ transform: xform({ x: dx, y: dy }), filter: a < 0.98 ? `blur(${((1 - a) * 8).toFixed(1)}px)` : undefined }}
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
