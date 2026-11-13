import React, { useEffect } from "react";
import { asset, holdRender, releaseRender, useFrame, useVideoConfig } from "../engine";
import { CloudBackground, GradientText, Highlight, Numeral, Stage, kf } from "../kit";
import type { CloudOptions } from "../kit";
import { themeEasing } from "../kit/util";
import {
  accentMark, backgroundLayer, backgroundSamples, borderWidth, contrastRatio, cornerRadius, entrance, numeralStyle, parseColor, resolveColor,
  resolveStyle, surfaceStyle, textStyle, useTheme, withAlpha, withStoryDefaults,
} from "../themes";
import type { Theme } from "../themes";
import { fade, styleKey, svgScale, xform } from "../fx/core/math";
import type { ListLayout } from "./layout";
import { INLINE_SEP, ROW_GAP, fitText, pillFit } from "./layout";
import { parseRich } from "./types";
import type { StoryDesign, StorySpec } from "./types";


/**
 * Diseño de la historia: `spec.design` del video sobre los valores del design system (`withStoryDefaults`). Lo que el video indica gana; lo
 * que no, sale de `theme.style` (con el tema por defecto es el aspecto de siempre). Función pura del tema, del `spec` y del tamaño del cuadro.
 * En formato alto (vertical) las columnas y filas del muro del TEMA no rigen (están pensadas para el ancho: el muro alto lo decide el formato);
 * las que el video pide en `spec.design.wall` sí.
 */
export function resolveStoryDesign(theme: Theme, design: StoryDesign | undefined, width: number, height: number): StoryDesign {
  const d = withStoryDefaults(theme, design) as StoryDesign;
  if (height / width > 1.3 && d.wall && (design?.wall?.columns === undefined || design?.wall?.rows === undefined)) {
    const { columns, rows, ...rest } = d.wall;
    return { ...d, wall: { ...rest, ...(design?.wall?.columns !== undefined ? { columns } : {}), ...(design?.wall?.rows !== undefined ? { rows } : {}) } };
  }
  return d;
}

/** `spec` con el diseño ya mezclado con el del tema: lo que todo bloque lee en lugar de `spec.design` crudo. Idempotente. */
export function resolveStorySpec(theme: Theme, spec: StorySpec, width: number, height: number): StorySpec {
  return { ...spec, design: resolveStoryDesign(theme, spec.design, width, height) };
}

/** El diseño de la historia con el del tema debajo (ver `resolveStoryDesign`). */
export function useStoryDesign(spec: StorySpec): StoryDesign {
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  return resolveStoryDesign(theme, spec.design, width, height);
}

/** `spec` con `design` ya mezclado (ver `useStoryDesign`). */
export function useStorySpec(spec: StorySpec): StorySpec {
  const theme = useTheme();
  const { width, height } = useVideoConfig();
  return resolveStorySpec(theme, spec, width, height);
}

/**
 * Escenario de la historia: `Stage` (que dibuja la capa de fondo del design system, `background.kind`: nubes, nada, grilla, puntos,
 * degradado o ruido) con las nubes del tamaño del cuadro. El fondo de `kit` se reparte por 1920×1080 y en vertical o cuadrado quedaba como una
 * franja arriba; acá se lo pide con el ancho y el alto reales (en horizontal es idéntico). Si el video pide nubes a propósito
 * (`spec.design.clouds`) se dibujan aunque el fondo del tema sea otro.
 */
export function StoryStage({ frame, cloud, children }: { frame?: number; /** Nubes de la historia (`spec.design.clouds`); lo que falte sale del tema. */ cloud?: CloudOptions; children?: React.ReactNode }) {
  const { width, height } = useVideoConfig();
  const theme = useTheme();
  const cur = useFrame();
  const layer = backgroundLayer(theme);
  const intensity = resolveStyle(theme).background.intensity;
  // nubes: las del tema solo con `background.kind: "clouds"`; con la intensidad por defecto no se pisa la opacidad (queda la del tema, como siempre)
  const clouds = layer.clouds || cloud !== undefined;
  const opacity = cloud?.opacity ?? (layer.clouds && intensity !== 1 ? layer.cloudOpacity : undefined);
  return (
    <Stage clouds={false} frame={frame}>
      {clouds && <CloudBackground {...cloud} opacity={opacity} frame={frame ?? cur} width={width} height={height} />}
      {children}
    </Stage>
  );
}

/** Escala los cuadros de un bloque cuando su duración se pisa con `timing`. */
export const scaler = (dur: number, base: number) => (n: number) => (n * dur) / base;

/** Pieza del muro (~30 px de letra): encendida = borde y texto con énfasis; `pop` agranda y da brillo un instante. */
export function Chip({ text, lit, pop, faint }: { text: string; lit: number; pop: number; faint?: boolean }) {
  const theme = useTheme();
  const on = lit > 0.5;
  const t = fitText(text, 400, theme.type.caption * 0.94, { min: theme.type.caption * 0.75, avg: 0.54 });
  // superficie, borde y sombra del design system (`surfaceStyle`); el borde nominal es de 2 px: si el tema lo cambia, el relleno lo compensa
  // y la pieza mide lo mismo (la medida no depende del estilo)
  const surf = surfaceStyle(theme, "chip", { on, faint, glow: pop });
  const lab = textStyle(theme, "label");
  const pad = (v: number) => `${v + (2 - borderWidth(theme, "chip"))}px`;
  // en reposo (pop = 0) sin `transform`: un `scale(1)` residual compone la pieza en capa propia y se rasteriza según el historial
  const style: React.CSSProperties = {
    padding: `${pad(t.size * 0.5)} ${pad(t.size * 0.9)}`,
    ...surf,
    fontSize: t.size,
    fontWeight: lab.fontWeight,
    color: on ? (faint ? theme.color.textMuted : theme.color.text) : theme.color.textMuted,
    whiteSpace: "nowrap",
    transform: pop > 0.01 ? xform({ scale: 1 + pop * 0.12 }) : undefined,
  };
  return (
    <div key={styleKey(style)} style={style}>
      {t.text}
    </div>
  );
}

/**
 * Color sólido del número de una píldora: el primer rol de acento que llega a 4,5:1 sobre la superficie del tema; si ninguno llega, el
 * texto del tema. El degradado no sirve acá: sobre la superficie de la píldora su contraste queda por debajo del mínimo en algunos temas.
 */
export function pillNumberColor(theme: Theme, bg: string = theme.color.surface, prefer: string[] = []): string {
  for (const c of [...prefer, theme.color.accent, theme.color.accent2]) if (contrastRatio(c, bg) >= 4.5) return c;
  return theme.color.text;
}

/**
 * Opacidad de las filas ya vistas (o sin escena) de la lista: `base` (0,75, pensada para las nubes del tema neutro), subida lo necesario
 * para que el texto atenuado (grande: el mínimo de `qa` es 3:1) conserve 3,1:1 sobre el peor fondo posible de las nubes EFECTIVAS (las de `theme.cloud` con lo que pise
 * `design.clouds`): el color de mancha más contrastante a la opacidad efectiva sobre `theme.color.bg`. Con nubes tenues no cambia `base`.
 */
export function quietOpacity(theme: Theme, clouds: CloudOptions | undefined, base: number): number {
  // con un fondo de patrón (grilla, puntos, degradado, ruido) y sin nubes pedidas por el video, el peor fondo es el del patrón (`backgroundSamples`)
  if (!backgroundLayer(theme).clouds && clouds === undefined) return quietOverSamples(theme, backgroundSamples(theme), base);
  const eff = clouds?.opacity ?? theme.cloud.opacity;
  const roles = [...(clouds?.colors ?? theme.cloud.colors), ...(clouds?.blobs ?? theme.cloud.blobs ?? []).flatMap((b) => (b.color ? [b.color] : []))];
  const bg = parseColor(theme.color.bg), fg = parseColor(theme.color.textMuted);
  if (!bg || !fg) return base;
  const mixc = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, p: number) => `rgb(${Math.round(a.r * (1 - p) + b.r * p)},${Math.round(a.g * (1 - p) + b.g * p)},${Math.round(a.b * (1 - p) + b.b * p)})`;
  let q = base;
  for (const role of roles) {
    const c = parseColor(resolveColor(theme, role));
    if (!c) continue;
    const under$ = mixc(bg, c, eff);
    const under = parseColor(under$)!;
    let k = base;
    while (k < 1 && contrastRatio(mixc(under, fg, k), under$) < 3.1) k = Math.round((k + 0.01) * 100) / 100;
    q = Math.max(q, k);
  }
  return q;
}

/** Opacidad mínima (desde `base`) con que el texto atenuado (`textMuted`) conserva 3,1:1 sobre el peor de los fondos `samples`. */
function quietOverSamples(theme: Theme, samples: string[], base: number): number {
  const fg = parseColor(theme.color.textMuted);
  if (!fg) return base;
  const mixc = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, p: number) => `rgb(${Math.round(a.r * (1 - p) + b.r * p)},${Math.round(a.g * (1 - p) + b.g * p)},${Math.round(a.b * (1 - p) + b.b * p)})`;
  let q = base;
  for (const bg$ of samples) {
    const under = parseColor(bg$);
    if (!under) continue;
    let k = base;
    while (k < 1 && contrastRatio(mixc(under, fg, k), bg$) < 3.1) k = Math.round((k + 0.01) * 100) / 100;
    q = Math.max(q, k);
  }
  return q;
}

/** Píldora con el número y el nombre del tema (cierre, ~34 px de letra). */
export function Pill({ index, name, scale = 1, glow = 0, maxW }: { index: number; name: string; scale?: number; glow?: number; /** Ancho total máximo (px): achica la letra y corta con "…" (ver `pillFit`). */ maxW?: number }) {
  const theme = useTheme();
  const f = useFrame();
  const t = pillFit(theme, name, maxW);
  // superficie del design system; el borde nominal es de 3 px (`pillFit` lo cuenta): si el tema lo cambia, el relleno lo compensa
  const surf = surfaceStyle(theme, "pill", { glow });
  const comp = 3 - borderWidth(theme, "pill");
  const title = textStyle(theme, "title");
  // el degradado no llega a 4,5:1 sobre la superficie: con `numerals: "gradient"` el número va en un color sólido; con otro estilo, el del tema
  const numeral = resolveStyle(theme).type.numerals === "gradient" ? { color: pillNumberColor(theme) } : numeralStyle(theme, { frame: f });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 16,
        padding: `${t.size * 0.42 + comp}px ${t.size * 0.9 + comp}px`,
        ...surf,
        whiteSpace: "nowrap",
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <span style={{ fontSize: t.numSize, fontWeight: theme.font.weights.stat, ...numeral }}>{String(index + 1).padStart(2, "0")}</span>
      <span style={{ fontSize: t.size, fontWeight: title.fontWeight, ...(title.letterSpacing ? { letterSpacing: title.letterSpacing } : {}), color: theme.color.text }}>{t.text}</span>
    </div>
  );
}

/**
 * Marca con tilde que se dibuja: p de 0 a 1 (primera mitad la forma, segunda la tilde). La forma sigue el lenguaje de esquinas del design
 * system (`cornerRadius` de chip): círculo con `pill`, cuadrado de esquinas suaves con `rounded`, cuadrado con `sharp`. El relleno es el degradado
 * de marca con `numerals: "gradient"` y el acento sólido con cualquier otro estilo de números.
 */
export function CheckMark({ p, size, id }: { p: number; size: number; id: string }) {
  const theme = useTheme();
  const c = Math.min(1, p * 2);
  const radius = cornerRadius(theme, "chip");
  const round = radius >= size / 2;
  const gradient = resolveStyle(theme).type.numerals === "gradient";
  const fill = gradient ? `url(#story-check-${id})` : theme.color.accent;
  const shape = { fill, opacity: c, transform: svgScale(23, 23, 0.6 + c * 0.4) };
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" style={{ overflow: "visible", display: "block" }}>
      {gradient && (
        <defs>
          <linearGradient id={`story-check-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={theme.color.accent} />
            <stop offset="1" stopColor={theme.color.accent2} />
          </linearGradient>
        </defs>
      )}
      {round ? <circle cx={23} cy={23} r={21} {...shape} /> : <rect x={2} y={2} width={42} height={42} rx={Math.min(21, (radius / size) * 46)} {...shape} />}
      <path d="M13 24l7 7 13-15" fill="none" stroke={theme.color.onAccent} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={34} strokeDashoffset={34 * (1 - Math.max(0, p * 2 - 1))} />
    </svg>
  );
}

/**
 * Número de la lista según `style.type.numerals`: el degradado de marca (`GradientText`, con su vaivén) o sólido, tenue o de contorno
 * (`numeralStyle`). Los números van sobre el fondo de la escena (`on: bg`): el sólido elige el acento que llega a 4,5:1 sobre él.
 */
export function StoryNumeral({ children, loop }: { children: string; loop?: number }) {
  const theme = useTheme();
  const f = useFrame();
  if (resolveStyle(theme).type.numerals === "gradient") return <GradientText loop={loop}>{children}</GradientText>;
  return <Numeral frame={f} loop={loop} on={theme.color.bg}>{children}</Numeral>;
}

/**
 * Movimiento de entrada de un elemento (`transform` / `clipPath`) según `style.motion.entrance`; el fundido lo lleva la opacidad de la
 * pieza, no esta ayuda. `dy` suma un desplazamiento vertical propio (el acople). Con la entrada `auto` es la propia de la pieza (`native`;
 * las filas de la lista se deslizan desde la derecha).
 */
export function moveIn(theme: Theme, p: number, index: number, o: { native?: "rise" | "fade" | "scale" | "slide" | "wipe"; distance: number; /** Profundidad (px) con `motion.entrance: "depth"`. */ depth?: number; dy?: number; round?: boolean; side?: "left" | "right" }): React.CSSProperties {
  const e = entrance(theme, p, index, { native: o.native ?? "slide", side: o.side ?? "right", distance: o.distance, depth: o.depth, round: o.round });
  const out: React.CSSProperties = {};
  const dy = o.dy ?? 0;
  const tr = [e.transform, dy !== 0 ? `translateY(${dy}px)` : undefined].filter(Boolean).join(" ");
  if (tr) out.transform = tr;
  if (e.clipPath) out.clipPath = e.clipPath;
  return out;
}

/** `moveIn` de una fila de la lista (se desliza desde la derecha con la entrada por defecto). */
export const rowEntrance = moveIn;

/**
 * Fila de la lista: número (o su reemplazo), nombre, línea y marca de acento (barra de degradado, filete o punto según `decor.accent`).
 * Se ubica en coordenadas del mundo (esquina de la fila). Todo lo que se anima (`opacity`, `transform`, `filter`, sombra del
 * subrayado) se emite solo mientras cambia: en reposo la fila no lleva transformaciones ni opacidades residuales.
 */
export function HeadlineRow({
  i, L, number, underline = 0, underlineOpacity = 1, quiet = 1, opacity = 1, style, gradientLoop,
}: {
  i: number;
  L: ListLayout;
  number?: React.ReactNode;
  underline?: number;
  underlineOpacity?: number;
  quiet?: number;
  opacity?: number;
  style?: React.CSSProperties;
  /** Cuadros de un vaivén del degradado del número (`design.gradient.loop`); sin él, quieto. */
  gradientLoop?: number;
}) {
  const theme = useTheme();
  const title = textStyle(theme, "title", { tracking: -0.02 });
  const root: React.CSSProperties = { position: "absolute", left: L.left, top: L.top + i * L.rowH, width: L.rowW, height: L.rowH, opacity: fade(opacity), ...style };
  const mark = accentMark(theme, { length: L.barWs[i] ?? L.barW, thickness: ROW_GAP.bar, progress: underline });
  // la marca ocupa el hueco de la barra: el filete y el punto (más finos) se centran en él
  const mh = mark ? Number(mark.style.height) : 0;
  const bar: React.CSSProperties | null = mark && {
    position: "absolute", left: L.barLeft, top: L.barTop + Math.round((ROW_GAP.bar - mh) / 2), height: mark.style.height, borderRadius: mark.style.borderRadius, width: mark.style.width,
    background: mark.style.background, boxShadow: mark.kind === "bar" && underline > 0.02 ? `0 0 18px ${withAlpha(theme.color.accent, 0.5)}` : undefined, opacity: mark.kind === "dot" ? mark.style.opacity : fade(underlineOpacity),
  };
  const num = number ?? <StoryNumeral loop={gradientLoop}>{String(i + 1).padStart(2, "0")}</StoryNumeral>;
  const nameStyle = { fontWeight: title.fontWeight, color: theme.color.text, letterSpacing: title.letterSpacing };
  // la línea de apoyo lleva la caja, el interletrado y el peso del rol `caption` solo si el design system los fijó (`follow: false`: no hereda los del eyebrow)
  const cap = textStyle(theme, "caption", { follow: false });
  if (L.stacked) {
    const nameTop = L.blockTop + L.numH + L.numGap;
    const block: React.CSSProperties = { position: "absolute", left: 0, top: L.blockTop, width: L.rowW, opacity: fade(quiet) };
    return (
      <div key={styleKey(root)} style={root}>
        <div key={`block-${styleKey(block)}`} style={block}>
          <div style={{ height: L.numH, lineHeight: `${L.numH}px`, fontSize: L.numSize, fontWeight: theme.font.weights.stat, position: "relative", whiteSpace: "nowrap" }}>{num}</div>
          <div style={{ position: "absolute", left: 0, top: nameTop - L.blockTop, fontSize: L.nameSize, lineHeight: `${L.nameH}px`, height: L.nameH, ...nameStyle, whiteSpace: "nowrap" }}>{L.names[i]}</div>
          <div style={{ position: "absolute", left: 0, top: nameTop - L.blockTop + L.nameH + ROW_GAP.a, fontSize: L.lineSize, lineHeight: `${L.lineH}px`, color: theme.color.textMuted, whiteSpace: "nowrap", ...cap }}>
            {L.lineRows[i]!.map((r, k) => <div key={k}>{r}</div>)}
          </div>
        </div>
        {bar && <div key={`bar-${styleKey(bar)}`} style={bar} />}
      </div>
    );
  }
  const block: React.CSSProperties = { position: "absolute", left: 0, top: L.blockTop, width: L.rowW, opacity: fade(quiet) };
  return (
    <div key={styleKey(root)} style={root}>
      <div key={`block-${styleKey(block)}`} style={block}>
        <div style={{ display: "flex", alignItems: "baseline", height: L.nameH, whiteSpace: "nowrap" }}>
          <span style={{ width: L.numW, flexShrink: 0, fontSize: L.numSize, fontWeight: theme.font.weights.stat, position: "relative" }}>{num}</span>
          <span style={{ fontSize: L.nameSize, lineHeight: `${L.nameH}px`, ...nameStyle }}>{L.names[i]}</span>
          {L.inline && (
            <>
              <span style={{ fontSize: L.lineSize, lineHeight: `${L.nameH}px`, color: theme.color.textMuted, whiteSpace: "pre" }}>{` ${INLINE_SEP} `}</span>
              <span style={{ fontSize: L.lineSize, lineHeight: `${L.nameH}px`, color: theme.color.textMuted, ...cap }}>{L.lines[i]}</span>
            </>
          )}
        </div>
        {!L.inline && <div style={{ marginLeft: L.numW, marginTop: ROW_GAP.a, height: L.lineH, fontSize: L.lineSize, lineHeight: `${L.lineH}px`, color: theme.color.textMuted, whiteSpace: "nowrap", ...cap }}>{L.lines[i]}</div>}
      </div>
      {bar && <div key={`bar-${styleKey(bar)}`} style={bar} />}
    </div>
  );
}

/** Texto con `**negrita**` (ver `parseRich`) para la firma: el fragmento en negrita sube un peso. Cada fragmento va en su propio elemento (los textos sueltos contiguos se parten distinto según el historial). */
export function RichText({ text, bold }: { text: string; bold?: number }) {
  const theme = useTheme();
  return (
    <>
      {parseRich(text).map((p, i) => (p.bold ? <strong key={i} style={{ fontWeight: bold ?? theme.font.weights.stat }}>{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/**
 * Texto con el fragmento `highlight` resaltado según `style.type.highlight`: el degradado de marca (con su vaivén), el color de acento, un
 * filete debajo o un marcador detrás. `progress` (0 a 1) dibuja el filete y el marcador de izquierda a derecha; los demás aparecen completos.
 */
export function HighlightedTitle({ text, highlight, loop, progress = 1 }: { text: string; highlight?: string; loop?: number; progress?: number }) {
  const theme = useTheme();
  const f = useFrame();
  const at = highlight ? text.indexOf(highlight) : -1;
  if (!highlight || at < 0) return <>{text}</>;
  const hl = resolveStyle(theme).type.highlight === "gradient" ? <GradientText loop={loop}>{highlight}</GradientText> : <Highlight frame={f} loop={loop} progress={progress}>{highlight}</Highlight>;
  return (
    <>
      {text.slice(0, at)}
      {hl}
      {text.slice(at + highlight.length)}
    </>
  );
}

/** Imagen que bloquea el cuadro hasta cargar (para que el render no capture antes de tiempo). */
export function Logo({ src, style }: { src: string; style?: React.CSSProperties }) {
  const url = asset(src);
  useEffect(() => {
    const h = holdRender(`logo:${src}`);
    const img = new Image();
    const done = () => releaseRender(h);
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (img.complete) done();
    return done;
  }, [url, src]);
  return <img src={url} alt="" style={style} />;
}

export { kf };

/** Curvas del tema como funciones de easing. */
export function useEase() {
  const theme = useTheme();
  return { out: themeEasing(theme.motion.easing.out), inOut: themeEasing(theme.motion.easing.inOut) };
}
