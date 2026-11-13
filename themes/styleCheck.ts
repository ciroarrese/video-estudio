import type { Theme } from "./types";
import type { ContrastWarning } from "./contrast";
import { mixColors } from "./color";
import { resolveStyleInput, styleIssues } from "./style";
import { backgroundSamples } from "./styleBackground";

/**
 * Revisión de `theme.style` para `checkTheme`: valores inválidos (error) y combinaciones que dañan la lectura (aviso o error según el contraste):
 * superficie de vidrio tenue sobre un fondo cargado, texto atenuado sobre superficies teñidas o marcadores, números atenuados, fondos de
 * patrón bajo el texto, y tarjetas sin borde ni sombra que se pierden contra el fondo. `ratio` es `contrastRatio` (se pasa para no
 * crear un ciclo de módulos); los pares se pueden reconocer en `theme.acknowledge` como el resto (`style.surface.glass/textMuted`).
 */
export function styleWarnings(theme: Theme, ratio: (a: string, b: string) => number): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  const ack = new Set(theme.acknowledge ?? []);
  const issues = styleIssues(theme.style);
  for (const i of issues) {
    out.push({ pair: `style.${i.path}`, ratio: 0, required: 0, severity: "error", message: `style.${i.path} = ${JSON.stringify(i.value)} no es válido (acepta ${i.accepted})` });
  }
  if (issues.length) return out;

  const st = resolveStyleInput(theme.style, theme.name);
  const c = theme.color;
  const add = (pair: string, r: number, required: number, what: string, fix: string) => {
    if (r >= required) return;
    const acknowledged = ack.has(pair);
    const severity = acknowledged ? "note" : r < 3 ? "error" : "warning";
    out.push({
      pair,
      ratio: r,
      required,
      severity,
      message: `${pair}: contraste ${r.toFixed(2)}:1, mínimo ${required}:1 (${severity}). ${what}. ${fix}`,
      ...(acknowledged ? { acknowledged: true } : {}),
    });
  };
  const worst = (fg: string, bgs: string[]) => Math.min(...bgs.map((b) => ratio(fg, b)));
  const samples = backgroundSamples(theme);

  // vidrio: la superficie se compone sobre el peor fondo posible
  if (st.surface.kind === "glass" || st.story.titleCard === "glass") {
    const glassOver = (o: number) => samples.map((s) => mixColors(s, c.surface, o));
    for (const role of ["text", "textMuted"] as const) {
      const r = worst(c[role], glassOver(st.surface.opacity));
      let need: number | undefined;
      for (let o = Math.round(st.surface.opacity * 100) + 1; o <= 100; o++) if (worst(c[role], glassOver(o / 100)) >= 4.5) { need = o / 100; break; }
      add(
        `style.surface.glass/${role}`,
        r,
        4.5,
        `El texto (${role}) sobre una superficie de vidrio con opacidad ${st.surface.opacity} y el fondo ${st.background.kind} pierde legibilidad`,
        need ? `Subí surface.opacity a ${need} o más, o usá un fondo plain.` : "Ni con opacidad 1 llega: revisá los colores del tema.",
      );
    }
  }
  // superficie teñida
  if (st.surface.kind === "tinted") {
    const tint = mixColors(c.surface, c.accent, 0.1);
    for (const role of ["text", "textMuted"] as const) {
      add(`style.surface.tinted/${role}`, ratio(c[role], tint), 4.5, `El texto (${role}) sobre la superficie teñida de acento`, "Usá un acento más claro u oscuro, o surface.kind: solid.");
    }
  }
  // números atenuados (cifras grandes: 3:1)
  if (st.type.numerals === "muted") {
    add("style.type.numerals/textMuted", worst(c.textMuted, [c.bg, c.surface]), 3, "Los números atenuados usan textMuted", "Usá numerals: solid o un textMuted más fuerte.");
  }
  // marcador translúcido: el texto va encima
  if (st.type.highlight === "marker") {
    const marks = [c.bg, c.surface].map((b) => mixColors(b, c.accent, 0.35));
    add("style.type.highlight/marker", worst(c.text, marks), 4.5, "El texto resaltado con marcador queda sobre el acento al 35 %", "Usá un acento más claro, o highlight: underline.");
  }
  // patrones de fondo: el texto suelto cae sobre las líneas o los puntos
  if (["grid", "dots", "gradient", "noise"].includes(st.background.kind)) {
    for (const role of ["text", "textMuted"] as const) {
      add(`style.background.${st.background.kind}/${role}`, worst(c[role], samples), 4.5, `El texto (${role}) sobre el fondo ${st.background.kind} a intensidad ${st.background.intensity}`, "Bajá background.intensity o usá un fondo plain.");
    }
  }
  // tarjetas sin borde ni sombra: solo las separa el relleno
  const noEdge = st.surface.kind !== "outline" && (!st.shape.outlined || st.shape.border <= 0) && st.surface.elevation === "flat";
  if (noEdge) {
    const fill = st.surface.kind === "glass" ? mixColors(c.bg, c.surface, st.surface.opacity) : st.surface.kind === "tinted" ? mixColors(c.surface, c.accent, 0.1) : c.surface;
    add("style.surface/edge", ratio(fill, c.bg), 1.08, "Las tarjetas no tienen borde ni sombra y su relleno casi no se distingue del fondo", "Activá shape.outlined o usá surface.elevation: shadow / border.");
  }
  return out;
}
