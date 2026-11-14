import type { Theme } from "./types";
import { parseColor, rgbToHsl, fromHsl } from "./color";
import { styleWarnings } from "./styleCheck";

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function lumOf(c: { r: number; g: number; b: number }): number {
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Luminancia relativa WCAG (0..1); ignora el alfa. */
export function relativeLuminance(color: string): number {
  const c = parseColor(color);
  if (!c) throw new Error(`Color inválido: ${color}`);
  return lumOf(c);
}

type RGB = { r: number; g: number; b: number; a: number };
function over(fg: RGB, bg: RGB): RGB {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

/** Razón de contraste WCAG. Un fondo translúcido se compone sobre blanco y un texto translúcido sobre el fondo. */
export function contrastRatio(a: string, b: string): number {
  const fg = parseColor(a);
  const bg0 = parseColor(b);
  if (!fg) throw new Error(`Color inválido: ${a}`);
  if (!bg0) throw new Error(`Color inválido: ${b}`);
  const bg = over(bg0, { r: 255, g: 255, b: 255, a: 1 });
  const la = lumOf(over(fg, bg));
  const lb = lumOf(bg);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastWarning {
  pair: string;
  ratio: number;
  required: number;
  /** "error" si el contraste es gravemente bajo (< 3), "warning" si no llega al mínimo, "note" si el tema reconoce el par en `acknowledge`. */
  severity: "warning" | "error" | "note";
  message: string;
  /** Dónde se usa ese color en las piezas de `kit/`, `fx/` y `stories/` (solo para los roles del tema). */
  usedBy?: string[];
  /** Tono más cercano del mismo matiz que sí llega al mínimo (hex). */
  suggestion?: string;
  /** `true` si el par está en `theme.acknowledge`. */
  acknowledged?: boolean;
}

/**
 * Dónde usan las piezas de `kit/`, `fx/` y `stories/` cada rol de color, para que un aviso diga qué toca arreglar y qué no.
 * `texto` es lo que exige 4.5:1; `gráfico` (trazos, rellenos, puntos) solo pide 3:1 y lo juzga cada escena.
 */
export const ROLE_USAGE: Record<string, { text?: string[]; graphic?: string[] }> = {
  text: { text: ["todo el texto de las escenas y las piezas"] },
  textMuted: { text: ["subtítulo de DockedHeadline", "rótulos secundarios de las piezas de fx/ui y stories"] },
  onAccent: { text: ["texto sobre rellenos de acento: ChatThread, PaperCollage, etiquetas de stories"] },
  accent: {
    text: ["GradientText (degradado de marca como texto)", "número de DockedHeadline", "titulares con degradado de stories"],
    graphic: ["trazo de DoodleCircle/Arrow/Underline", "onda de Cursor", "rellenos y trazos de fx/ui y fx/art"],
  },
  accent2: {
    text: ["GradientText (final del degradado)", "número de DockedHeadline (final del degradado)"],
    graphic: ["punta de DoodleArrow", "fx/art (LogoLand, ShapeMorph, HalftoneWave)"],
  },
  success: { text: ["rótulo de TileDone (fx/ui)", "deltas y estados de las escenas"], graphic: ["borde y relleno de TileDone"] },
  warning: { text: ["estados de las escenas"], graphic: ["cinta de PaperCollage (fx/art)"] },
  danger: { text: ["estados de las escenas"], graphic: [] },
  chart: { graphic: ["barras de BarsGrow (fx/data)", "fichas del cierre de stories"] },
};

const SURFACES = ["bg", "surface", "surfaceAlt"] as const;

/**
 * Color de una superficie declarada en `DataCheck.on`: un rol de superficie (`bg`...), un color de datos (`data.fichaFondo`) o un color.
 * `undefined` si no es ninguno de los tres.
 */
export function surfaceColor(theme: Theme, on: string): string | undefined {
  const c = theme.color as unknown as Record<string, unknown>;
  const v = c[on];
  if (typeof v === "string") return v;
  if (on.startsWith("data.")) return theme.data?.[on.slice(5)];
  return parseColor(on) ? on : undefined;
}

/** Tono más cercano del mismo matiz (cambia solo la luminosidad HSL) que llega a `required` sobre `bg`; `undefined` si ninguno llega. */
export function suggestShade(fg: string, bg: string, required: number): string | undefined {
  const c = parseColor(fg);
  if (!c) return undefined;
  const [h, s, l] = rgbToHsl(c);
  let best: string | undefined;
  let bestDist = Infinity;
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 100; step++) {
      const l2 = l + (dir * step) / 100;
      if (l2 < 0 || l2 > 1) break;
      const cand = fromHsl(h, s, l2);
      if (contrastRatio(cand, bg) >= required) {
        if (step < bestDist) {
          bestDist = step;
          best = cand;
        }
        break;
      }
    }
  }
  return best;
}

/**
 * El color de texto más legible sobre un relleno cualquiera (celdas amarillas, naranjas, verdes...).
 * Devuelve, entre los candidatos, el de mayor contraste con `bg`; en un empate gana el primero.
 * Candidatos por defecto: `theme.color.text`, `onAccent` y `surface` (en ese orden). Un relleno translúcido se
 * compone sobre blanco, como en `contrastRatio`. No avisa si ninguno llega a 4.5:1: para eso están `contrastRatio` y `qa`.
 */
export function readableOn(theme: Theme, bg: string, opts: { candidates?: string[] } = {}): string {
  const c = theme.color;
  const lista = opts.candidates?.length ? opts.candidates : [c.text, c.onAccent, c.surface];
  let best = lista[0]!;
  let bestRatio = -1;
  for (const cand of lista) {
    const r = contrastRatio(cand, bg);
    if (r > bestRatio) {
      best = cand;
      bestRatio = r;
    }
  }
  return best;
}

const mismoColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Colores [primer plano, fondo] de un par por nombre (`accent/bg`, `chart[0]/surface`, `data.estado/surface`), o `undefined` si no existe. */
export function pairColors(theme: Theme, pair: string): [string, string] | undefined {
  const [fgRef, bgRef] = pair.split("/");
  if (!fgRef || !bgRef) return undefined;
  const c = theme.color as unknown as Record<string, unknown>;
  const bg = surfaceColor(theme, bgRef);
  if (typeof bg !== "string") return undefined;
  let fg: unknown;
  const chart = /^chart\[(\d+)\]$/.exec(fgRef);
  if (chart) fg = theme.color.chart[Number(chart[1])];
  else if (fgRef.startsWith("data.")) fg = theme.data?.[fgRef.slice(5)];
  else fg = c[fgRef];
  return typeof fg === "string" ? [fg, bg] : undefined;
}

function usageText(role: string, onlyText: boolean): string[] {
  const u = ROLE_USAGE[role];
  if (!u) return [];
  const out: string[] = [];
  if (u.text?.length) out.push(`como texto: ${u.text.join(", ")}`);
  if (!onlyText && u.graphic?.length) out.push(`como gráfico: ${u.graphic.join(", ")}`);
  return out;
}

/**
 * Texto normal exige 4.5 (aviso); por debajo de 3 es error.
 * Cubre texto/fondo, atenuado, onAccent/accent, acentos y colores de estado como texto
 * sobre bg/surface/surfaceAlt (estado) y bg/surface (acentos), la serie `chart` sobre surface (>= 3)
 * y los colores de `theme.data` sobre las superficies que declaran en `dataChecks` (por defecto `surface`, mínimo 3).
 *
 * También revisa `theme.style` (valores inválidos y combinaciones que dañan la lectura: ver `styleWarnings`).
 *
 * Cada aviso trae `usedBy` (dónde usan las piezas de kit/fx/stories ese color) y `suggestion` (el tono más cercano que pasa).
 * Los pares de `theme.acknowledge` (p. ej. `"accent/bg"`) salen con severidad `note`: es una marca aprobada que se conoce;
 * `qa` sigue juzgando el texto real en pantalla.
 */
export function checkTheme(theme: Theme): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  const ack = new Set(theme.acknowledge ?? []);
  const seen = new Set<string>();
  /** reconocimientos con pin cuyos colores cambiaron: par -> descripción */
  const vencidos = new Map<string, string>();
  const check = (pair: string, fg: string, bg: string, required = 4.5, role?: string, scope?: string) => {
    seen.add(pair);
    let ratio: number;
    try {
      ratio = contrastRatio(fg, bg);
    } catch {
      out.push({ pair, ratio: 0, required, severity: "error", message: `${pair}: color inválido` });
      return;
    }
    let acknowledged = ack.has(pair);
    const pin = theme.acknowledgePins?.[pair];
    if (acknowledged && pin && !(mismoColor(pin[0], fg) && mismoColor(pin[1], bg))) {
      acknowledged = false;
      vencidos.set(pair, `el reconocimiento de "${pair}" ya no corresponde: se aprobó con ${pin[0]} sobre ${pin[1]} y ahora es ${fg} sobre ${bg}`);
    }
    if (ratio >= required) return;
    const severity = acknowledged ? "note" : ratio < 3 ? "error" : "warning";
    const usedBy = role ? usageText(role, required <= 3) : [];
    const suggestion = suggestShade(fg, bg, required);
    let message = `${pair}: contraste ${ratio.toFixed(2)}:1, mínimo ${required}:1 (${severity})`;
    if (acknowledged) message += " reconocido por el tema";
    if (vencidos.has(pair)) {
      message += `. Ojo: ${vencidos.get(pair)}`;
      vencidos.delete(pair); // ya quedó dicho en este aviso
    }
    if (usedBy.length) message += `. Se usa ${usedBy.join("; ")}`;
    if (scope) message += `. Ámbito declarado: ${scope} (el control de calidad, qa, juzga igual el texto real en pantalla contra su fondo real)`;
    if (suggestion) message += `. Tono más cercano que pasa: ${suggestion}`;
    out.push({
      pair,
      ratio,
      required,
      severity,
      message,
      ...(usedBy.length ? { usedBy } : {}),
      ...(suggestion ? { suggestion } : {}),
      ...(acknowledged ? { acknowledged: true } : {}),
    });
  };
  const c = theme.color;
  check("text/bg", c.text, c.bg, 4.5, "text");
  check("textMuted/bg", c.textMuted, c.bg, 4.5, "textMuted");
  check("onAccent/accent", c.onAccent, c.accent, 4.5, "onAccent");
  for (const role of ["accent", "accent2"] as const) {
    check(`${role}/bg`, c[role], c.bg, 4.5, role);
    check(`${role}/surface`, c[role], c.surface, 4.5, role);
  }
  for (const role of ["success", "warning", "danger"] as const) {
    for (const bg of SURFACES) check(`${role}/${bg}`, c[role], c[bg], 4.5, role);
  }
  c.chart.forEach((col, i) => check(`chart[${i}]/surface`, col, c.surface, 3, "chart"));
  const data = theme.data ?? {};
  for (const name of Object.keys(data)) {
    const spec = theme.dataChecks?.[name];
    for (const on of spec?.on ?? ["surface"]) {
      const bg = surfaceColor(theme, on);
      if (bg === undefined) {
        out.push({ pair: `data.${name}/${on}`, ratio: 0, required: spec?.min ?? 3, severity: "error", message: `data.${name}/${on}: la superficie "${on}" no es un rol de superficie, un color de datos ni un color válido` });
        continue;
      }
      check(`data.${name}/${on}`, data[name]!, bg, spec?.min ?? 3, undefined, spec?.scope);
    }
  }
  out.push(...styleWarnings(theme, contrastRatio));
  for (const [pair, msg] of vencidos) {
    const colors = pairColors(theme, pair);
    const ratio = colors ? contrastRatio(colors[0], colors[1]) : 0;
    out.push({ pair, ratio, required: 0, severity: "warning", message: `${pair}: ${msg} (el par hoy pasa el mínimo: quitalo de acknowledge o volvé a aprobarlo)` });
  }
  for (const pair of ack) {
    if (seen.has(pair) || pair.startsWith("style.")) continue;
    out.push({
      pair,
      ratio: 0,
      required: 0,
      severity: "note",
      acknowledged: true,
      message: `${pair}: figura en acknowledge pero no es un par que se revise (revisá el nombre)`,
    });
  }
  return out;
}
