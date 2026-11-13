import type { Theme, ResolvedTheme } from "./types";
import { STYLE_ENUMS } from "./styleTypes";
import type { ThemeStyle, ThemeStyleInput } from "./styleTypes";

/** Descripción de un campo de `theme.style`: de acá salen los valores por defecto, la validación, los tokens y el informe. */
export type StyleFieldSpec =
  | { path: string; type: "enum"; values: readonly string[]; def: string; doc: string }
  | { path: string; type: "bool"; def: boolean; doc: string }
  | { path: string; type: "num"; min: number; max: number; int?: boolean; def: number | null; nullable?: boolean; doc: string }
  | { path: string; type: "role"; def: string; doc: string };

const E = STYLE_ENUMS;
const en = (path: string, values: readonly string[], def: string, doc: string): StyleFieldSpec => ({ path, type: "enum", values, def, doc });
const bo = (path: string, def: boolean, doc: string): StyleFieldSpec => ({ path, type: "bool", def, doc });
const nu = (path: string, min: number, max: number, def: number, doc: string, int = false): StyleFieldSpec => ({ path, type: "num", min, max, def, int, doc });
const nf = (path: string, min: number, max: number, doc: string): StyleFieldSpec => ({ path, type: "num", min, max, def: null, int: false, nullable: true, doc });
const nn = (path: string, min: number, max: number, doc: string): StyleFieldSpec => ({ path, type: "num", min, max, def: null, int: true, nullable: true, doc });

/**
 * Todos los campos de `theme.style`, en el orden del documento. Los valores por defecto reproducen el aspecto de siempre
 * (los que usaban `kit/`, `stories/` y `fx/` antes de que existiera la capa de estilo).
 */
export const STYLE_FIELDS: readonly StyleFieldSpec[] = [
  en("shape.corners", E.corners, "pill", "lenguaje de esquinas"),
  nu("shape.border", 0, 6, 1, "grosor base del borde (px)"),
  bo("shape.outlined", true, "las superficies llevan borde"),
  nf("shape.heroScale", 0.5, 4, "radio del cartel del título, como múltiplo de radius.lg (vacío = el de siempre: 2 con pill, 1,5 con rounded)"),
  en("surface.kind", E.surfaceKind, "solid", "tratamiento de la tarjeta"),
  en("surface.elevation", E.elevation, "shadow", "modelo de elevación"),
  nu("surface.opacity", 0.3, 1, 0.74, "opacidad de las superficies translúcidas"),
  en("type.titleWeight", E.weight, "semibold", "peso de los titulares"),
  en("type.labelWeight", E.weight, "medium", "peso de los rótulos"),
  nu("type.titleTracking", -0.1, 0.2, 0, "interletrado extra de titulares (em)"),
  en("type.eyebrowCase", E.eyebrowCase, "as-is", "caja de los eyebrows"),
  nu("type.eyebrowTracking", 0, 0.4, 0, "interletrado de eyebrows (em)"),
  en("type.captionCase", E.captionCase, "eyebrow", "caja de subtítulos y líneas de apoyo (eyebrow = sigue a eyebrowCase)"),
  nf("type.captionTracking", 0, 0.4, "interletrado de subtítulos y líneas de apoyo (em; vacío = el de eyebrowTracking)"),
  en("type.captionWeight", E.captionWeight, "auto", "peso de subtítulos y líneas de apoyo (auto = el de la pieza)"),
  en("type.numerals", E.numerals, "gradient", "estilo de los números"),
  en("type.highlight", E.highlight, "gradient", "estilo de la palabra resaltada"),
  en("background.kind", E.backgroundKind, "clouds", "tipo de fondo"),
  nu("background.intensity", 0, 1, 1, "intensidad del fondo"),
  en("motion.entrance", E.entrance, "auto", "entrada de los elementos (auto = la propia de cada pieza)"),
  nu("motion.overshoot", 0, 0.3, 0, "rebote al asentarse"),
  nu("motion.stagger", 0, 12, 4, "cuadros entre elementos escalonados", true),
  nn("motion.staggerList", 0, 60, "cuadros entre filas de la lista de la apertura (vacío = según stagger)"),
  nn("motion.staggerRows", 0, 60, "cuadros entre filas de interfaces y de la vuelta al listado (vacío = según stagger)"),
  nn("motion.staggerItems", 0, 60, "cuadros entre elementos pequeños (vacío = según stagger)"),
  nf("motion.staggerChips", 0, 10, "cuadros por pieza entre las piezas del muro (vacío = 0,5 de siempre)"),
  bo("motion.cameraBlur", true, "desenfoque de movimiento de la cámara"),
  nu("motion.cameraTilt", 0, 3, 1, "multiplicador de la inclinación de la cámara"),
  en("motion.transition", E.transition, "wash", "transición entre escenas"),
  bo("decor.doodles", true, "garabatos activados"),
  en("decor.doodleStroke", E.doodleStroke, "hand", "trazo de los garabatos"),
  nu("decor.vignette", 0, 2, 1, "multiplicador de la viñeta"),
  { path: "decor.vignetteColor", type: "role", def: "accent", doc: "rol de color de la viñeta" },
  en("decor.accent", E.accent, "bar", "marca de acento"),
  nu("decor.accentThickness", 0.25, 4, 1, "multiplicador del grosor de la marca de acento"),
  nu("decor.gradientLoop", 0, 600, 0, "cuadros del vaivén del degradado (0 = quieto)", true),
  en("story.titleCard", E.titleCard, "solid", "cartel del título"),
  en("story.listLayout", E.listLayout, "stacked", "diseño de la lista de temas"),
  en("story.listUnderline", E.listUnderline, "row", "largo del subrayado de la lista"),
  en("story.handoff", E.handoff, "wash", "cómo termina la apertura"),
  en("story.headlineSize", E.headlineSize, "md", "tamaño de la píldora del titular"),
  { path: "story.closingBg", type: "role", def: "bg", doc: "rol del fondo del cierre" },
  bo("story.signoffBar", true, "barra de la firma"),
  nn("story.wallColumns", 2, 12, "columnas del muro (vacío = según el formato)"),
  nn("story.wallRows", 2, 12, "filas del muro (vacío = según el formato)"),
  nu("story.wallChipScale", 0.5, 3, 1, "tamaño de las piezas del muro"),
  nu("story.wallDolly", -240, 2000, 0, "recorrido extra de cámara (px)"),
  nu("story.wallDepth", 0, 3, 1, "dispersión en profundidad del muro"),
  nu("story.wallGapX", 0.4, 3, 1, "separación horizontal entre piezas del muro (multiplicador)"),
  nu("story.wallGapY", 0.4, 3, 1, "separación vertical entre piezas del muro (multiplicador)"),
  nu("story.wallBrick", 0, 3, 1, "corrimiento ladrillo entre filas del muro (multiplicador; 0 = grilla alineada)"),
  nu("story.wallJitter", 0, 4, 1, "temblor de posición de las piezas del muro (multiplicador; 0 = ninguno)"),
  bo("story.wallBlurOpening", true, "desenfoque por distancia en la apertura"),
  bo("story.wallBlurClosing", true, "desenfoque del muro al arrancar el cierre"),
  en("chart.barRadius", E.barRadius, "md", "esquinas de las barras"),
  nu("chart.lineWidth", 1, 12, 5, "grosor de las líneas de datos (px)"),
  en("chart.grid", E.chartGrid, "auto", "líneas de guía"),
  en("chart.fill", E.chartFill, "solid", "relleno de barras y áreas"),
  en("line.weight", E.lineWeight, "regular", "escala del grosor de los trazos"),
  en("line.dash", E.lineDash, "solid", "carácter de las líneas guía"),
  en("line.cap", E.lineCap, "round", "terminación de los trazos"),
  nu("line.glow", 0, 1, 0, "halo de trazos y puntos"),
  en("line.dotShape", E.dotShape, "round", "forma de los puntos"),
  en("line.accentUse", E.accentUse, "balanced", "cuánto de una figura va en acento"),
  nu("line.sketch", 0, 1, 0, "temblor de trazo a mano"),
  en("solid.fill", E.solidFill, "shaded", "relleno de las caras de los sólidos"),
  nu("solid.contrast", 0.2, 1.6, 1, "contraste de luz entre caras"),
  en("solid.edge", E.solidEdge, "gap", "arista de las caras"),
  en("depth.extrude", E.extrude, "stack", "extrusión de texto y volumen"),
  bo("depth.fog", true, "atenuación con la distancia"),
  en("text.arrival", E.arrival, "rise", "llegada de las letras"),
  en("text.caret", E.caret, "bar", "cursor de escritura"),
  en("text.tile", E.tile, "card", "losetas y bandas de texto"),
  en("text.charset", E.charset, "caps", "alfabeto de los glifos al azar"),
  en("text.decoration", E.decoration, "none", "adorno bajo el texto"),
];

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Nombre del token de un campo: `shape.corners` -> `style-shape-corners`; `story.wallChipScale` -> `style-story-wall-chip-scale`. */
export const styleTokenName = (path: string): string => `style-${path.split(".").map(kebab).join("-")}`;

/** Descripción corta de lo que acepta un campo, para los mensajes de error y el informe. */
export function acceptedValues(spec: StyleFieldSpec): string {
  switch (spec.type) {
    case "enum": return spec.values.join(" | ");
    case "bool": return "true | false";
    case "role": return "un rol de color del tema (bg, surface, surfaceAlt...)";
    case "num": return `${spec.int ? "entero" : "número"} de ${spec.min} a ${spec.max}${spec.nullable ? " o vacío (auto)" : ""}`;
  }
}

const TRUE = new Set(["true", "on", "si", "sí", "yes", "1"]);
const FALSE = new Set(["false", "off", "no", "0"]);
const ROLES = new Set(["bg", "surface", "surfaceAlt", "text", "textMuted", "border", "accent", "accent2"]);

/** Valida y convierte un valor (de un objeto o de un token: cadenas incluidas). `ok: false` si no es válido. */
export function parseStyleValue(spec: StyleFieldSpec, raw: unknown): { ok: true; value: string | number | boolean | null } | { ok: false } {
  const bad = { ok: false } as const;
  switch (spec.type) {
    case "enum": {
      const v = typeof raw === "string" ? raw.trim() : raw;
      return typeof v === "string" && spec.values.includes(v) ? { ok: true, value: v } : bad;
    }
    case "bool": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      const v = String(raw).trim().toLowerCase();
      if (TRUE.has(v)) return { ok: true, value: true };
      if (FALSE.has(v)) return { ok: true, value: false };
      return bad;
    }
    case "role": {
      const v = typeof raw === "string" ? raw.trim() : "";
      return ROLES.has(v) ? { ok: true, value: v } : bad;
    }
    case "num": {
      if (raw === null || raw === "" || (typeof raw === "string" && /^(auto|null|none)$/i.test(raw.trim()))) {
        return spec.nullable ? { ok: true, value: null } : bad;
      }
      let n: number;
      if (typeof raw === "number") n = raw;
      else if (typeof raw === "string") {
        const m = /^(-?\d*\.?\d+)\s*(%|px|em|ms)?$/.exec(raw.trim());
        if (!m) return bad;
        n = parseFloat(m[1]!);
        if (m[2] === "%" && spec.max <= 1) n /= 100;
      } else return bad;
      if (!Number.isFinite(n) || n < spec.min || n > spec.max) return bad;
      if (spec.int && !Number.isInteger(n)) return bad;
      if (spec.path === "decor.gradientLoop" && n === 1) return bad;
      return { ok: true, value: n };
    }
  }
}

const SPECS = new Map(STYLE_FIELDS.map((f) => [f.path, f]));
const GROUPS = [...new Set(STYLE_FIELDS.map((f) => f.path.split(".")[0]!))];

export interface StyleIssue {
  path: string;
  value: unknown;
  /** Qué acepta el campo (o qué claves existen, si el campo no existe). */
  accepted: string;
}

/** Problemas de un `style` declarado a mano (valores fuera de rango, claves que no existen). No lanza: lista todos. */
export function styleIssues(input: unknown): StyleIssue[] {
  const out: StyleIssue[] = [];
  if (input === undefined || input === null) return out;
  if (typeof input !== "object" || Array.isArray(input)) return [{ path: "style", value: input, accepted: `un objeto con los grupos ${GROUPS.join(", ")}` }];
  for (const [g, grp] of Object.entries(input as Record<string, unknown>)) {
    if (!GROUPS.includes(g)) {
      out.push({ path: g, value: grp, accepted: `grupos: ${GROUPS.join(", ")}` });
      continue;
    }
    if (grp === undefined) continue;
    if (typeof grp !== "object" || grp === null || Array.isArray(grp)) {
      out.push({ path: g, value: grp, accepted: "un objeto con los campos del grupo" });
      continue;
    }
    for (const [k, v] of Object.entries(grp as Record<string, unknown>)) {
      if (v === undefined) continue;
      const spec = SPECS.get(`${g}.${k}`);
      if (!spec) {
        out.push({ path: `${g}.${k}`, value: v, accepted: `campos de ${g}: ${STYLE_FIELDS.filter((f) => f.path.startsWith(`${g}.`)).map((f) => f.path.slice(g.length + 1)).join(", ")}` });
      } else if (!parseStyleValue(spec, v).ok) {
        out.push({ path: spec.path, value: v, accepted: acceptedValues(spec) });
      }
    }
  }
  return out;
}

const build = (get: (f: StyleFieldSpec) => unknown): ThemeStyle => {
  const out: Record<string, Record<string, unknown>> = {};
  for (const f of STYLE_FIELDS) {
    const [g, k] = f.path.split(".") as [string, string];
    (out[g] ??= {})[k] = get(f);
  }
  return out as unknown as ThemeStyle;
};

/** Valores por defecto de `theme.style`: el aspecto de siempre. */
export const DEFAULT_STYLE: ThemeStyle = build((f) => f.def);

const pick = (input: unknown, path: string): unknown => {
  const [g, k] = path.split(".") as [string, string];
  const grp = (input as Record<string, Record<string, unknown> | undefined> | undefined)?.[g];
  return grp?.[k];
};

const resolved = new WeakSet<object>();
const cache = new WeakMap<object, ThemeStyle>();

/** `true` si `style` es el objeto completo que devolvió `resolveStyleInput` (no hace falta volver a validarlo). */
export const isResolvedStyle = (style: unknown): style is ThemeStyle => typeof style === "object" && style !== null && resolved.has(style);

/**
 * Completa un `style` parcial con los valores por defecto. Lanza un error claro (con lo que se acepta) si algún valor no es válido:
 * un valor mal escrito no se ignora en silencio. Idempotente: un `style` ya completo da el mismo resultado.
 */
export function resolveStyleInput(input: ThemeStyleInput | undefined, themeName = "tema"): ThemeStyle {
  if (input && typeof input === "object") {
    if (resolved.has(input)) return input as ThemeStyle;
    const hit = cache.get(input);
    if (hit) return hit;
  }
  const issues = styleIssues(input);
  if (issues.length) {
    throw new Error(
      `Tema "${themeName}": style no es válido. ` +
        issues.map((i) => `style.${i.path} = ${JSON.stringify(i.value)} (acepta ${i.accepted})`).join("; "),
    );
  }
  const out = build((f) => {
    const raw = pick(input, f.path);
    return raw === undefined ? f.def : (parseStyleValue(f, raw) as { value: unknown }).value;
  });
  resolved.add(out);
  if (input && typeof input === "object") cache.set(input, out);
  return out;
}

/** El estilo completo de un tema (ya resuelto si viene de `useTheme()`). */
export function resolveStyle(theme: Theme | ResolvedTheme): ThemeStyle {
  const s = (theme as ResolvedTheme).style;
  return isResolvedStyle(s) ? s : resolveStyleInput(theme.style, theme.name);
}

/** Mezcla `over` sobre `base` (ambos parciales, grupo por grupo). */
export function mergeStyleInput(base: ThemeStyleInput | undefined, over: ThemeStyleInput | undefined): ThemeStyleInput {
  const out: Record<string, Record<string, unknown>> = {};
  for (const src of [base, over]) {
    for (const [g, grp] of Object.entries((src ?? {}) as Record<string, Record<string, unknown> | undefined>)) {
      if (grp && typeof grp === "object") out[g] = { ...(out[g] ?? {}), ...grp };
    }
  }
  return out as ThemeStyleInput;
}
