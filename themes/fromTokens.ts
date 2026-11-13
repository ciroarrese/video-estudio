import type { Theme } from "./types";
import { neutral } from "./neutral";
import { isValidColor, shiftColor } from "./color";
import { checkTheme, contrastRatio } from "./contrast";
import { deepClone } from "./util";

export type TokenInput = string | Record<string, unknown>;

export interface TokenOptions {
  /** Solo para CSS: selector del bloque a leer (por defecto ":root"). */
  selector?: string;
}

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
  if (typeof obj === "string" || typeof obj === "number") {
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
      if (typeof leaf === "string" || typeof leaf === "number") {
        out.set(norm(path.join("-")), String(leaf));
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
const RADIUS_KEYS = ["sm", "md", "panel", "lg", "pill"] as const;
const SHADOW_KEYS = ["sm", "md", "lg"] as const;

function toPx(v: string): number | null {
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em)?$/.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

const UNRESOLVED = /var\(|\{[^}]*\}/;

/** Mapea tokens de diseño (JSON W3C/plano o CSS con variables) a un Theme. */
export function themeFromTokensWithReport(
  input: TokenInput,
  base: Theme = neutral,
  options: TokenOptions = {},
): { theme: Theme; report: TokenReport } {
  const flat: Flat = typeof input === "string" ? parseCss(input, options.selector) : new Map();
  if (typeof input !== "string") flattenObject(input, [], flat);
  resolveRefs(flat);

  const theme: Theme = deepClone(base);
  const report: TokenReport = { mapped: {}, fallback: [], derived: [], warnings: [], ambiguous: {} };
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
      false,
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
  if (mappedAccent || mappedAccent2) {
    theme.cloud.colors = [theme.color.accent, theme.color.accent2, shiftColor(theme.color.accent, -40, 0)];
    report.derived.push("cloud.colors");
  }

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

  for (const w of checkTheme(theme)) report.warnings.push(`Contraste: ${w.message}`);
  return { theme, report };
}

export function themeFromTokens(input: TokenInput, base: Theme = neutral, options: TokenOptions = {}): Theme {
  return themeFromTokensWithReport(input, base, options).theme;
}
