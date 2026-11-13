import type { Theme } from "./types";
import type { ContrastWarning } from "./contrast";
import { mixColors } from "./color";
import { resolveStyleInput, styleIssues } from "./style";
import { backgroundSamples } from "./styleBackground";

/**
 * Revisión de `theme.style` para `checkTheme`: valores inválidos (error) y combinaciones que dañan la lectura (aviso o error según el contraste):
 * superficie de vidrio tenue sobre un fondo cargado, texto atenuado sobre superficies teñidas o marcadores, números atenuados, fondos de
 * patrón bajo el texto, tarjetas sin borde ni sombra que se pierden contra el fondo y, de los grupos `line`, `solid` y `text`, las líneas finas de
 * poco contraste, las aristas de sólidos que no se separan del fondo, el cursor de bloque y las losetas y adornos de texto. `ratio` es `contrastRatio` (se pasa para no
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
  // `errorBelow`: por debajo de ese contraste el aviso es un error (3 por defecto; las líneas finas y las aristas piden menos)
  const add = (pair: string, r: number, required: number, what: string, fix: string, errorBelow = 3) => {
    if (r >= required) return;
    const acknowledged = ack.has(pair);
    const severity = acknowledged ? "note" : r < errorBelow ? "error" : "warning";
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
  // ---------- grupos nuevos: line, solid, depth, text ----------

  // líneas finas: los ejes, las guías y los contornos se dibujan con `border` (y los datos, con el acento) a la mitad del grosor
  if (st.line.weight === "hairline") {
    add("style.line.hairline/border", ratio(c.border, c.bg), 2, "Con line.weight hairline las guías y los ejes (color.border) quedan a medio grosor sobre el fondo", "Usá line.weight regular, o un color.border más fuerte.", 1.4);
    add("style.line.hairline/accent", ratio(c.accent, c.bg), 3, "Con line.weight hairline el trazo de acento queda a medio grosor", "Usá line.weight regular, o un acento más contrastado con el fondo.");
  }
  // trazos con halo: el resplandor rodea trazos de acento; si el acento no se distingue del fondo no hay nada que resaltar
  if (st.line.glow > 0) {
    add("style.line.glow/accent", ratio(c.accent, c.bg), 3, "El halo de line.glow rodea trazos de acento", "Bajá line.glow a 0 o usá un acento más contrastado con el fondo.");
  }
  // sólidos: la arista tiene que separarse del fondo
  if (st.solid.fill === "outline" || st.solid.fill === "translucent") {
    if (st.solid.edge === "none") {
      add("style.solid.edge/none", 1, 3, `Con solid.fill ${st.solid.fill} y solid.edge none el sólido no tiene arista que lo marque`, "Usá solid.edge ink o accent, o solid.fill shaded / flat.");
    } else {
      const edge = st.solid.edge === "accent" ? c.accent : c.text;
      add(`style.solid.edge/${st.solid.edge}`, ratio(edge, c.bg), 3, `La arista (${st.solid.edge === "accent" ? "color.accent" : "color.text"}) de un sólido ${st.solid.fill} sobre el fondo`, "Usá solid.edge ink, o un color más contrastado.");
    }
  }
  if (st.solid.fill !== "outline" && st.solid.contrast < 0.4) {
    add("style.solid.contrast", st.solid.contrast, 0.4, `solid.contrast ${st.solid.contrast}: las caras de un sólido apenas se distinguen entre sí`, "Subí solid.contrast a 0,4 o más, o usá solid.fill outline.", 0.2);
  }
  // texto: losetas (`SplitFlap`), cursor de bloque y adornos
  // `card` y `flat`: glifo `bg` sobre loseta `text`; `outline`: glifo y contorno `text` sobre `bg`; en los tres, el par que decide es text/bg
  add(`style.text.tile.${st.text.tile}/ink`, ratio(c.text, c.bg), 4.5, `Con text.tile ${st.text.tile} el glifo y la loseta salen de color.text y color.bg, que casi no se distinguen`, "Usá un color.text y un color.bg más contrastados, o pasá tileColor y color a SplitFlap.");
  if (st.text.caret === "block") {
    add("style.text.caret/onAccent", ratio(c.onAccent, c.accent), 4.5, "Con text.caret block el glifo bajo el cursor va en onAccent sobre un bloque de acento", "Usá text.caret bar o underscore, o un onAccent más contrastado con el acento.");
  }
  if (st.text.decoration === "marker") {
    add("style.text.decoration/marker", ratio(c.text, mixColors(c.bg, c.accent, 0.28)), 4.5, "El marcador de text.decoration va detrás del texto (acento al 28 % sobre el fondo)", "Usá text.decoration underline o un acento más claro.");
  } else if (st.text.decoration === "underline" || st.text.decoration === "box") {
    add(`style.text.decoration/${st.text.decoration}`, ratio(c.accent, c.bg), 3, `El adorno ${st.text.decoration} se dibuja con color.accent sobre el fondo`, "Usá un acento más contrastado o text.decoration none.");
  }
  return out;
}
