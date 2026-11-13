import type { CloudBlob, CubicBezier, DataCheck, DataSurface, ResolvedTheme, Theme } from "./types";
import type { ThemeStyleInput } from "./styleTypes";
import { STYLE_FIELDS, acceptedValues, mergeStyleInput, parseStyleValue, styleIssues, styleTokenName } from "./style";
import { neutral } from "./neutral";
import { isValidColor, shiftColor } from "./color";
import { checkTheme, contrastRatio, pairColors, surfaceColor } from "./contrast";
import { deepClone } from "./util";
import { DATA_NAME, DEFAULT_TYPE_DISPLAY, resolveTheme } from "./data";

export type TokenInput = string | Record<string, unknown>;

export interface TokenOptions {
  /** Solo para CSS: selector del bloque a leer (por defecto ":root"). */
  selector?: string;
  /**
   * Colores con nombre del video que no tienen rol en `Theme` (estados, severidades, fondos de ficha...), legibles con `useTheme().data.<nombre>`.
   * Cada entrada es el nombre de un token (o un color, si no hay un token con ese nombre), o `{ token | color, on?, min? }`:
   * `on` son las superficies donde se dibuja (por defecto `surface`; un rol, otro color de datos como `data.fichaFondo` o un color, para las superficies
   * propias de una interfaz recreada dentro de un `ThemeScope`) y `min` el contraste que se le pide (3 por defecto; 4.5 para texto).
   * `scope` es una nota de dónde aparece (queda en `report.data` y en el aviso); `checkTheme` lo juzga solo contra esas superficies, y `qa` sigue juzgando el texto real.
   * Entran en `report.data` y en los avisos de contraste de `checkTheme`.
   */
  data?: Record<string, DataRoleInput>;
  /** Pares de contraste de marca que se dan por conocidos (`["accent/bg"]`); `checkTheme` los informa como `note`, mientras los colores del par sigan siendo los aprobados. */
  acknowledge?: string[];
  /**
   * Forma compacta de las decisiones de estilo (`theme.style`), que pisa a los tokens `--style-*`: `{ style: { shape: { corners: "sharp" }, surface: { kind: "glass" } } }`.
   * Un valor inválido no lanza: se ignora y queda en `report.style.invalid` (y en `report.warnings`) con lo que acepta el campo.
   */
  style?: ThemeStyleInput;
}

export type DataRoleInput =
  | string
  | { token?: string; color?: string; on?: DataSurface | DataSurface[]; min?: number; scope?: string };

export interface TokenReport {
  /** rol del tema -> nombre del token de origen */
  mapped: Record<string, string>;
  /** roles que quedaron con el valor del tema base */
  fallback: string[];
  /** roles calculados a partir de otros (p. ej. onAccent) */
  derived: string[];
  /** valores inválidos ignorados y avisos de contraste */
  warnings: string[];
  /** rol -> tokens que también podían mapearse a él y perdieron por prioridad */
  ambiguous: Record<string, string[]>;
  /** colores de datos declarados: nombre -> color, de dónde salió y contra qué se revisa */
  data: Record<string, { color: string; source: string } & DataCheck>;
  /** pares de contraste reconocidos en `acknowledge` (no son avisos) */
  notes: string[];
  /** Decisiones de estilo: de dónde salió cada campo, cuáles quedaron con el valor de la base y cuáles se ignoraron por inválidas. */
  style: {
    /** campo (`shape.corners`) -> token de origen (`style-shape-corners`) o `options.style` */
    mapped: Record<string, string>;
    /** campos que quedaron con el valor del tema base (o el por defecto) */
    fallback: string[];
    /** valores ignorados, con lo que acepta el campo (o los campos válidos, si el nombre no existe) */
    invalid: { path: string; source: string; value: unknown; accepted: string }[];
  };
}

type Flat = Map<string, string>;

const norm = (s: string) =>
  s
    .trim()
    .replace(/^--/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[._/\s]+/g, "-")
    .replace(/-+/g, "-");

function flattenObject(obj: unknown, path: string[], out: Flat): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    out.set(norm(path.join("-")), String(obj));
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenObject(v, [...path, String(i + 1)], out));
    return;
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    const leaf = "$value" in o ? o.$value : "value" in o && typeof o.value !== "object" ? o.value : undefined;
    if (leaf !== undefined) {
      if (typeof leaf === "string" || typeof leaf === "number" || typeof leaf === "boolean") {
        out.set(norm(path.join("-")), String(leaf));
      } else if (Array.isArray(leaf)) {
        // una lista como valor (`"$value": [0.4, 0, 0.2, 1]`, una curva): queda como `nombre-1` ... `nombre-4`
        flattenObject(leaf, path, out);
      }
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("$")) continue;
      flattenObject(v, [...path, k], out);
    }
  }
}

function declarations(body: string, out: Flat): void {
  const re = /(--[\w-]+)\s*:\s*([^;}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.set(norm(m[1]), m[2].trim());
}

/** Lee solo el primer bloque cuyo selector coincide; los @media se ignoran salvo que se pidan. */
function parseCss(css: string, selector = ":root"): Flat {
  const out: Flat = new Map();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (!clean.includes("{")) {
    declarations(clean, out);
    return out;
  }
  const want = selector.trim().replace(/\s+/g, " ");
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf("{", i);
    if (open < 0) break;
    const prelude = clean.slice(i, open).trim().replace(/\s+/g, " ");
    let depth = 1;
    let j = open + 1;
    while (j < clean.length && depth > 0) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") depth--;
      j++;
    }
    const body = clean.slice(open + 1, j - 1);
    const sels = prelude.split(",").map((x) => x.trim());
    if (prelude.startsWith("@") ? prelude === want : sels.includes(want)) {
      declarations(body, out);
      return out;
    }
    i = j;
  }
  return out;
}

function resolveRefs(flat: Flat): void {
  for (const [k, v0] of flat) {
    let v = v0;
    for (let i = 0; i < 6; i++) {
      const next = v
        .replace(/^\{([^}]+)\}$/, (_, p: string) => flat.get(norm(p)) ?? `{${p}}`)
        .replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, p: string) => flat.get(norm(p)) ?? `var(${p})`);
      if (next === v) break;
      v = next;
    }
    flat.set(k, v);
  }
}

const stripSuffix = (n: string) => n.replace(/-(default|base|main|value|500)$/, "");

const COLOR_ALIASES: Record<string, string[]> = {
  bg: ["bg", "background", "background-default", "background-primary", "bg-default", "page", "canvas", "surface-background", "body"],
  surface: ["surface", "surface-default", "card", "panel", "background-elevated", "background-secondary", "bg-surface", "container"],
  surfaceAlt: ["surface-alt", "surface-secondary", "surface-variant", "surface-2", "surface-muted", "background-alt", "secondary-background", "muted", "bg-alt", "bg-muted", "background-tertiary"],
  text: ["text", "text-primary", "text-default", "foreground", "fg", "on-background", "on-surface", "content", "ink"],
  textMuted: ["text-muted", "text-secondary", "text-subtle", "text-tertiary", "muted-foreground", "foreground-muted", "foreground-secondary", "fg-muted", "on-surface-variant", "content-muted"],
  border: ["border", "border-default", "outline", "divider", "stroke", "line"],
  accent: ["accent", "accent-primary", "primary", "brand", "brand-primary", "primary-default", "action", "interactive", "highlight"],
  accent2: ["accent2", "accent-2", "accent-secondary", "secondary", "brand-secondary", "secondary-accent", "tertiary"],
  onAccent: ["on-accent", "accent-foreground", "on-primary", "primary-foreground", "text-on-accent", "text-on-primary", "on-brand", "brand-foreground"],
  success: ["success", "positive", "ok", "green"],
  warning: ["warning", "warn", "caution", "attention"],
  danger: ["danger", "error", "destructive", "negative", "critical", "red"],
};

const FONT_FAMILY = ["font-family", "font-family-base", "font-family-sans", "font-sans", "font-body", "font-base", "font-primary", "typography-font-family", "typography-family", "font-family-body", "font"];
const WEIGHT_ALIASES: Record<string, string[]> = {
  regular: ["regular", "normal", "400"],
  medium: ["medium", "500"],
  semibold: ["semibold", "semi-bold", "600"],
  stat: ["stat", "bold", "700", "heavy"],
};
const GRADIENT_BRAND = ["gradient-brand", "gradient-primary", "brand-gradient", "gradient-accent", "gradient"];
const TYPE_KEYS = ["hero", "h1", "h2", "body", "caption", "eyebrow", "stat"] as const;
const UI_KEYS = ["xs", "sm", "md"] as const;
const RADIUS_KEYS = ["sm", "md", "panel", "lg", "pill"] as const;
const SHADOW_KEYS = ["sm", "md", "lg"] as const;

function toPx(v: string): number | null {
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em)?$/.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

const UNRESOLVED = /var\(|\{[^}]*\}/;

const EASE_KEYS: [keyof Theme["motion"]["easing"], string[]][] = [
  ["standard", ["ease-standard"]],
  ["out", ["ease-out"]],
  ["inOut", ["ease-in-out", "ease-inout"]],
];

/** Curva de un token: `cubic-bezier(.4, 0, .2, 1)`, `0.4 0 0.2 1` o `0.4, 0, 0.2, 1`. `null` si no son cuatro números con x1 y x2 entre 0 y 1. */
export function parseBezier(v: string): CubicBezier | null {
  const body = /^cubic-bezier\(([^)]*)\)$/i.exec(v.trim())?.[1] ?? v.trim().replace(/^\[|\]$/g, "");
  const p = body.split(/[\s,]+/).filter(Boolean).map(Number);
  if (p.length !== 4 || !p.every(Number.isFinite)) return null;
  if (p[0]! < 0 || p[0]! > 1 || p[2]! < 0 || p[2]! > 1) return null;
  return [p[0]!, p[1]!, p[2]!, p[3]!];
}

/** Curva dada como lista JSON (`"$value": [0.4, 0, 0.2, 1]` llega aplanada como `nombre-1` ... `nombre-4`). */
function bezierFromParts(flat: Flat, names: string[]): readonly [string, CubicBezier] | undefined {
  for (const n of names) {
    const parts = [1, 2, 3, 4].map((i) => flat.get(`${n}-${i}`));
    if (parts.every((x) => x !== undefined)) {
      const b = parseBezier(parts.join(" "));
      if (b) return [n, b];
    }
  }
  return undefined;
}

/** Duración de un token en cuadros: `12`, `12f`, `400ms` o `0.4s` (a 30 fps). `null` si no es un número positivo de 1 a 600 cuadros. */
export function parseDuration(v: string): number | null {
  const m = /^(\d*\.?\d+)\s*(f|frames?|ms|s)?$/i.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]!);
  const u = (m[2] ?? "f").toLowerCase();
  const frames = u === "ms" ? (n * 30) / 1000 : u === "s" ? n * 30 : n;
  const r = Math.round(frames);
  return r >= 1 && r <= 600 ? r : null;
}

/** Mapea tokens de diseño (JSON W3C/plano o CSS con variables) a un Theme. */
export function themeFromTokensWithReport(
  input: TokenInput,
  base: Theme = neutral,
  options: TokenOptions = {},
): { theme: ResolvedTheme; report: TokenReport } {
  const flat: Flat = typeof input === "string" ? parseCss(input, options.selector) : new Map();
  if (typeof input !== "string") flattenObject(input, [], flat);
  resolveRefs(flat);

  const theme: Theme = deepClone(base);
  const report: TokenReport = { mapped: {}, fallback: [], derived: [], warnings: [], ambiguous: {}, data: {}, notes: [], style: { mapped: {}, fallback: [], invalid: [] } };
  const used = new Set<string>();

  /** Tokens que coinciden con alguno de los nombres, en orden de prioridad (nombre exacto antes que sufijo -default/-500). */
  const matches = (names: string[], withPrefix = true): [string, string][] => {
    const res: [string, string][] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const keys = withPrefix ? [n, `color-${n}`, `colors-${n}`] : [n];
      for (const exact of [true, false]) {
        for (const key of keys) {
          for (const [k, v] of flat) {
            if (used.has(k) || seen.has(k)) continue;
            if (exact ? k === key : stripSuffix(k) === key) {
              seen.add(k);
              res.push([k, v]);
            }
          }
        }
      }
    }
    return res;
  };
  const note = (role: string, key: string, losers: string[] = []) => {
    report.mapped[role] = key;
    used.add(key);
    if (losers.length) report.ambiguous[role] = losers;
  };
  /** Primer token válido; los demás candidatos quedan en report.ambiguous. */
  const pick = (
    role: string,
    names: string[],
    valid: (v: string) => boolean,
    what: string,
    withPrefix = true,
  ): string | undefined => {
    const all = matches(names, withPrefix);
    let winner: [string, string] | undefined;
    const losers: string[] = [];
    for (const [k, v] of all) {
      if (!winner && valid(v)) winner = [k, v];
      else if (winner) losers.push(k);
      else report.warnings.push(`${what} inválido ignorado en "${k}": ${v}`);
    }
    if (!winner) return undefined;
    note(role, winner[0], losers);
    return winner[1].trim();
  };
  const noUnresolved = (role: string, names: string[], what: string, extra: (v: string) => boolean = () => true) => {
    const v = pick(
      role,
      names,
      (x) => {
        if (UNRESOLVED.test(x)) return false;
        return x.trim() !== "" && extra(x);
      },
      what,
      false,
    );
    return v;
  };

  // Colores
  for (const role of Object.keys(COLOR_ALIASES)) {
    const v = pick(`color.${role}`, COLOR_ALIASES[role], isValidColor, "Color", true);
    if (v) (theme.color as unknown as Record<string, string>)[role] = v;
  }

  // Serie de gráfico
  const chart: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const v = pick(
      `color.chart[${chart.length}]`,
      [`chart-${i}`, `chart-color-${i}`, `series-${i}`, `data-${i}`],
      isValidColor,
      "Color",
      true,
    );
    if (v) chart.push(v);
  }
  if (chart.length) theme.color.chart = chart;

  // Derivados a partir de los colores mapeados
  const mappedAccent = "color.accent" in report.mapped;
  const mappedAccent2 = "color.accent2" in report.mapped;
  if (mappedAccent && !("color.onAccent" in report.mapped)) {
    const acc = theme.color.accent;
    theme.color.onAccent = contrastRatio("#000000", acc) >= contrastRatio("#ffffff", acc) ? "#000000" : "#ffffff";
    report.derived.push("color.onAccent");
  }
  if (mappedAccent && !mappedAccent2) {
    theme.color.accent2 = shiftColor(theme.color.accent, 40, 0);
    report.derived.push("color.accent2");
  }
  const g = noUnresolved("gradient.brand", GRADIENT_BRAND, "Degradado", (x) => /gradient\(/i.test(x));
  if (g) theme.gradient.brand = g;
  else if (mappedAccent || mappedAccent2) {
    theme.gradient.brand = `linear-gradient(90deg, ${theme.color.accent} 0%, ${theme.color.accent2} 100%)`;
    report.derived.push("gradient.brand");
  }

  // Nubes: colores (lista), cantidad, semilla, opacidad y manchas explícitas
  const cloudColors: string[] = [];
  const listed = matches(["cloud-colors", "cloud-palette"], false)[0];
  if (listed) {
    const parts = listed[1].split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
    const okParts = parts.filter(isValidColor);
    for (const bad of parts.filter((x) => !isValidColor(x))) report.warnings.push(`Color inválido ignorado en "${listed[0]}": ${bad}`);
    if (okParts.length) {
      cloudColors.push(...okParts);
      note("cloud.colors", listed[0]);
    }
  }
  for (let i = 1; i <= 12 && !listed; i++) {
    const v = pick(`cloud.colors[${cloudColors.length}]`, [`cloud-color-${i}`, `cloud-colors-${i}`], isValidColor, "Color", false);
    if (v) cloudColors.push(v);
  }
  if (cloudColors.length) theme.cloud.colors = cloudColors;
  else if (mappedAccent || mappedAccent2) {
    theme.cloud.colors = [theme.color.accent, theme.color.accent2, shiftColor(theme.color.accent, -40, 0)];
    report.derived.push("cloud.colors");
  }
  const cnt = pick("cloud.count", ["cloud-count", "clouds-count"], (x) => Number.isInteger(+x) && +x >= 1 && +x <= 24, "Cantidad de nubes", false);
  if (cnt) theme.cloud.count = +cnt;
  const sd = noUnresolved("cloud.seed", ["cloud-seed"], "Semilla de nubes");
  if (sd) theme.cloud.seed = sd;
  const op = pick("cloud.opacity", ["cloud-opacity"], (x) => {
    const n = x.trim().endsWith("%") ? parseFloat(x) / 100 : Number(x);
    return Number.isFinite(n) && n >= 0 && n <= 1;
  }, "Opacidad de nubes", false);
  if (op) theme.cloud.opacity = op.trim().endsWith("%") ? parseFloat(op) / 100 : Number(op);
  const cb = pick("cloud.blur", ["cloud-blur"], (x) => {
    const m = /^(\d*\.?\d+)\s*(px)?$/.exec(x.trim());
    return !!m && +m[1]! >= 0 && +m[1]! <= 400;
  }, "Desenfoque de nubes (px, de 0 a 400)", false);
  if (cb) theme.cloud.blur = parseFloat(cb);
  const blobs: CloudBlob[] = [];
  // el valor puede venir entre comillas ("x y tamaño") o sin ellas
  const sinComillas = (x: string) => x.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
  for (let i = 1; i <= 24; i++) {
    const v = pick(`cloud.blobs[${blobs.length}]`, [`cloud-blob-${i}`], (x) => {
      const p = sinComillas(x).split(/[\s,]+/).map(Number);
      return p.length >= 2 && p.length <= 3 && p.every(Number.isFinite) && p[0]! >= 0 && p[0]! <= 1 && p[1]! >= 0 && p[1]! <= 1 && (p[2] === undefined || p[2] > 0);
    }, "Mancha de nube (\"x y tamaño\", x e y entre 0 y 1)", false);
    if (v) {
      const p = sinComillas(v).split(/[\s,]+/).map(Number);
      blobs.push({ x: p[0]!, y: p[1]!, ...(p[2] ? { size: p[2] } : {}) });
    }
  }
  if (blobs.length) theme.cloud.blobs = blobs;

  // Tipografía
  const fam = noUnresolved("font.family", FONT_FAMILY, "Familia tipográfica", (x) => !/^\d/.test(x.trim()));
  if (fam) theme.font.family = fam;
  for (const w of Object.keys(WEIGHT_ALIASES) as (keyof Theme["font"]["weights"])[]) {
    const names = WEIGHT_ALIASES[w].flatMap((a) => [`font-weight-${a}`, `weight-${a}`, `fw-${a}`, `font-${a}`]);
    const v = pick(`font.weights.${w}`, names, (x) => {
      const n = parseInt(x, 10);
      return n >= 100 && n <= 900;
    }, "Peso de fuente", false);
    if (v) theme.font.weights[w] = parseInt(v, 10);
  }
  for (const t of TYPE_KEYS) {
    const v = pick(`type.${t}`, [`type-${t}`, `type-scale-${t}`, `font-size-${t}`, `text-${t}`, `video-${t}`],
      (x) => (toPx(x) ?? 0) > 0, "Tamaño", false);
    if (v) theme.type[t] = toPx(v)!;
  }
  for (const u of UI_KEYS) {
    const v = pick(`type.ui.${u}`, [`type-ui-${u}`, `font-size-ui-${u}`, `text-ui-${u}`, `video-ui-${u}`], (x) => (toPx(x) ?? 0) > 0, "Tamaño", false);
    if (v) theme.type.ui = { ...(theme.type.ui ?? { xs: 15, sm: 20, md: 24 }), [u]: toPx(v)! };
  }
  for (const d of ["sm", "md", "lg"] as const) {
    const v = pick(`type.display.${d}`, [`type-display-${d}`, `font-size-display-${d}`, `text-display-${d}`, `video-display-${d}`], (x) => (toPx(x) ?? 0) > 0, "Tamaño", false);
    if (v) theme.type.display = { ...(theme.type.display ?? DEFAULT_TYPE_DISPLAY), [d]: toPx(v)! };
  }

  // Colores de datos declarados por el video
  const lookup = (name: string): [string, string] | undefined => {
    const n = norm(name);
    for (const key of [n, `color-${n}`]) if (flat.has(key)) return [key, flat.get(key)!];
    return undefined;
  };
  theme.data = { ...(theme.data ?? {}) };
  theme.dataChecks = { ...(theme.dataChecks ?? {}) };
  for (const [role, raw] of Object.entries(options.data ?? {})) {
    if (!DATA_NAME.test(role)) {
      report.warnings.push(`Color de datos "${role}" ignorado: el nombre tiene que ser un identificador simple (letras y números, empezando con letra)`);
      continue;
    }
    const spec = typeof raw === "string" ? { token: raw } : raw;
    let color: string | undefined;
    let source = "";
    if (spec.color !== undefined) {
      color = spec.color.trim();
      source = "valor";
    } else {
      const name = spec.token ?? `data-${role}`;
      const hit = lookup(name);
      if (hit) {
        color = hit[1].trim();
        source = hit[0];
      } else if (typeof raw === "string" && isValidColor(raw)) {
        color = raw.trim();
        source = "valor";
      } else {
        report.warnings.push(`Color de datos "${role}": no hay un token "${name}"; el nombre no queda declarado`);
        continue;
      }
    }
    if (!isValidColor(color)) {
      report.warnings.push(`Color de datos "${role}" inválido ignorado${source === "valor" ? "" : ` en "${source}"`}: ${color}`);
      continue;
    }
    const check: DataCheck = {
      on: spec.on === undefined ? ["surface"] : Array.isArray(spec.on) ? spec.on : [spec.on],
      min: spec.min ?? 3,
      ...(spec.scope?.trim() ? { scope: spec.scope.trim() } : {}),
    };
    theme.data[role] = color;
    theme.dataChecks[role] = check;
    report.data[role] = { color, source, ...check };
    report.mapped[`data.${role}`] = source;
    if (source !== "valor") used.add(source);
  }
  // Superficies declaradas en `on`: un rol, un color de datos declarado o un color; si no, el nombre queda con un aviso y se descarta esa superficie
  for (const [role, chk] of Object.entries(report.data)) {
    const ok = chk.on.filter((x) => {
      if (surfaceColor(theme, x) !== undefined) return true;
      report.warnings.push(`Color de datos "${role}": la superficie "${x}" de \`on\` no es un rol de superficie, un color de datos declarado ni un color válido; se ignora`);
      return false;
    });
    if (ok.length !== chk.on.length) {
      const fixed: DataCheck = { ...chk, on: ok.length ? ok : ["surface"] };
      theme.dataChecks![role] = { on: fixed.on, min: fixed.min, ...(fixed.scope ? { scope: fixed.scope } : {}) };
      report.data[role] = { color: chk.color, source: chk.source, ...theme.dataChecks![role]! };
    }
  }
  // Los reconocimientos van atados a los colores con que se aprobaron: los que vienen de `base` con los colores de `base`,
  // los nuevos con los de este tema. Así un tema derivado con otro color en ese par no hereda un "aprobado" que no le corresponde.
  const pins: Record<string, [string, string]> = { ...(base.acknowledgePins ?? {}) };
  for (const n of base.acknowledge ?? []) {
    const c = pins[n] ?? pairColors(base, n);
    if (c) pins[n] = c;
  }
  for (const n of options.acknowledge ?? []) {
    const c = pairColors(theme, n);
    if (c) pins[n] = c;
  }
  if (options.acknowledge?.length) theme.acknowledge = [...new Set([...(theme.acknowledge ?? []), ...options.acknowledge])];
  if (Object.keys(pins).length) theme.acknowledgePins = pins;

  // Radios y sombras
  for (const r of RADIUS_KEYS) {
    const v = pick(`radius.${r}`, [`radius-${r}`, `border-radius-${r}`, `radii-${r}`, `rounded-${r}`, `corner-${r}`],
      (x) => (toPx(x) ?? -1) >= 0, "Radio", false);
    if (v) theme.radius[r] = toPx(v)!;
  }
  for (const sh of SHADOW_KEYS) {
    const v = noUnresolved(`shadow.${sh}`, [`shadow-${sh}`, `box-shadow-${sh}`, `elevation-${sh}`, `shadows-${sh}`], "Sombra");
    if (v) theme.shadow[sh] = v;
  }

  // Movimiento: curvas (`--ease-standard|out|in-out`) y duraciones (`--duration-fast|base|slow`, en cuadros o en ms a 30 fps)
  for (const [key, names] of EASE_KEYS) {
    const all = names.flatMap((n) => [n, `motion-${n}`, `easing-${n}`, `easings-${n}`]);
    let found: readonly [string, CubicBezier] | undefined;
    for (const [k, v] of matches(all, false)) {
      const b = parseBezier(v);
      if (b) {
        found = [k, b];
        break;
      }
      report.warnings.push(`Curva inválida ignorada en "${k}": ${v} (se espera cubic-bezier(x1, y1, x2, y2) o cuatro números; x1 y x2 entre 0 y 1)`);
    }
    found ??= bezierFromParts(flat, all);
    if (found) {
      theme.motion.easing[key] = found[1];
      report.mapped[`motion.easing.${key}`] = found[0];
      used.add(found[0]);
    }
  }
  for (const d of ["fast", "base", "slow"] as const) {
    const names = [`duration-${d}`, `motion-duration-${d}`, `durations-${d}`, `time-${d}`];
    const v = pick(`motion.duration.${d}`, names, (x) => parseDuration(x) !== null, "Duración (cuadros, o ms / s a 30 fps)", false);
    if (v) theme.motion.duration[d] = parseDuration(v)!;
  }

  // Estilo: tokens `style-*` y, encima, la forma compacta `options.style`
  const patch: Record<string, Record<string, unknown>> = {};
  const setStyle = (path: string, value: unknown, source: string) => {
    const [g, k] = path.split(".") as [string, string];
    (patch[g] ??= {})[k] = value;
    report.style.mapped[path] = source;
  };
  const rejectStyle = (path: string, source: string, value: unknown, accepted: string) => {
    report.style.invalid.push({ path, source, value, accepted });
    report.warnings.push(`Estilo inválido ignorado en "${source}" (${path}): ${JSON.stringify(value)}; acepta ${accepted}`);
  };
  const known = new Set(STYLE_FIELDS.map((f) => styleTokenName(f.path)));
  for (const spec of STYLE_FIELDS) {
    const tok = styleTokenName(spec.path);
    const raw = flat.get(tok);
    if (raw === undefined) continue;
    const r = UNRESOLVED.test(raw) ? { ok: false as const } : parseStyleValue(spec, raw);
    if (r.ok) {
      setStyle(spec.path, r.value, tok);
      used.add(tok);
    } else rejectStyle(spec.path, tok, raw, acceptedValues(spec));
  }
  for (const k of flat.keys()) {
    if (k.startsWith("style-") && !known.has(k)) rejectStyle(k, k, flat.get(k), "un campo de style: " + STYLE_FIELDS.map((f) => styleTokenName(f.path)).join(", "));
  }
  if (options.style) {
    for (const i of styleIssues(options.style)) rejectStyle(i.path, "options.style", i.value, i.accepted);
    for (const spec of STYLE_FIELDS) {
      const [g, k] = spec.path.split(".") as [string, string];
      const raw = (options.style as Record<string, Record<string, unknown> | undefined>)[g]?.[k];
      if (raw === undefined) continue;
      const r = parseStyleValue(spec, raw);
      if (r.ok) setStyle(spec.path, r.value, "options.style");
    }
  }
  if (Object.keys(patch).length) theme.style = mergeStyleInput(theme.style, patch as ThemeStyleInput);
  report.style.fallback = STYLE_FIELDS.map((f) => f.path).filter((p) => !(p in report.style.mapped));

  // Nombre
  const nm = matches(["name", "theme-name"], false)[0];
  theme.name = nm ? nm[1] : "custom";

  // Valores sin resolver que se descartaron: ya quedan en warnings desde pick.
  const roles = [
    ...Object.keys(COLOR_ALIASES).map((r) => `color.${r}`),
    "color.chart[0]",
    "gradient.brand",
    "font.family",
    ...RADIUS_KEYS.map((r) => `radius.${r}`),
    ...SHADOW_KEYS.map((x) => `shadow.${x}`),
  ];
  report.fallback = roles.filter((r) => !(r in report.mapped) && !report.derived.includes(r));

  for (const w of checkTheme(theme)) {
    if (w.severity === "note") report.notes.push(`Contraste: ${w.message}`);
    else report.warnings.push(`Contraste: ${w.message}`);
  }
  return { theme: resolveTheme(theme), report };
}

export function themeFromTokens(input: TokenInput, base: Theme = neutral, options: TokenOptions = {}): ResolvedTheme {
  return themeFromTokensWithReport(input, base, options).theme;
}
