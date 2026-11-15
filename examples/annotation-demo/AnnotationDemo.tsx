import { useFrame } from "../../engine";
import { ThemeProvider, annotationLook, cornerRadius, dark, editorial, entrance, neon, neutral, papel, staggerFrames, surfaceStyle, textStyle, useTheme } from "../../themes";
import type { AnnotationMarkSetting, Theme } from "../../themes";
import { Callout, CountUp, Eyebrow, FocusGroup, Highlight, Stage, Wash, kf } from "../../kit";

/** Temas que la demo conoce por nombre. */
const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
export const ANNOTATION_DEMO_THEMES = Object.keys(TEMAS);

export type AnnotationDemoProps = {
  /** `neutral` | `dark` | `editorial` | `neon` | `papel` (por defecto neutral); también acepta un objeto Theme (para pruebas). */
  theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme;
  /** Fuerza una señal distinta de la del design system (la excepción explícita de `Callout`). Sin ella manda el tema. */
  variant?: AnnotationMarkSetting;
};

// Disposición inventada (píxeles de la pantalla, escala 1): tres fichas en un panel y dos filas debajo; la llamada señala la del medio.
const PANEL = { x: 140, y: 270, w: 1640, h: 690 };
const CARD = { w: 460, h: 230 };
const cardX = (i: number) => PANEL.x + 60 + i * 520;
const CARD_Y = PANEL.y + 60;
const TARGET = { x: cardX(1), y: CARD_Y, w: CARD.w, h: CARD.h };
const STATS = [
  { label: "Nuevos", value: 128 },
  { label: "En curso", value: 42 },
  { label: "Cerrados", value: 87 },
];
const TARGET_INDEX = 1;

/** Una ficha de estadística: entrada escalonada y número que cuenta (función pura del cuadro). */
function Ficha({ s, i }: { s: (typeof STATS)[number]; i: number }) {
  const t = useTheme();
  const f = useFrame();
  const d = staggerFrames(t, i, { base: 4 });
  const a = kf(f, [4 + d, 18 + d], [0, 1]);
  return (
    <div
      style={{
        position: "absolute", left: cardX(i), top: CARD_Y, width: CARD.w, minHeight: CARD.h, boxSizing: "border-box", padding: 30,
        ...surfaceStyle(t, "card", { level: "sm", bold: true, corner: "panel" }), ...entrance(t, a, i, { native: "rise", distance: 30 }),
      }}
    >
      <Eyebrow style={{ display: "block", lineHeight: 1.2 }}>{s.label}</Eyebrow>
      <div style={{ fontSize: t.type.stat * 0.6, lineHeight: 1.2, fontWeight: t.font.weights.stat, color: t.color.chart[i % t.color.chart.length] }}>
        <CountUp frame={f} from={0} to={s.value} start={10 + d} duration={34} />
      </div>
    </div>
  );
}
const FILAS = ["Elemento alfa", "Elemento beta"];
const T = { callout: [44, 128] as [number, number], wash: [132, 149] as [number, number] };
const SAFE = { x: 140, y: 110, w: 1640, h: 860 };

/**
 * La misma escena para los cinco design systems: una llamada sobre la ficha del medio. Lo que cambia entre uno y otro no es el color sino
 * **la señal** (`style.annotation.mark`): flecha recta, línea con codo y punto, corchete, anillo con halo o trazo a mano; también el resalte de
 * la palabra del titular (`type.highlight`) y el velo de salida (`motion.transition`). La escena no decide nada de eso: lee el tema.
 */
function Escena({ variant }: { variant?: AnnotationMarkSetting }) {
  const t = useTheme();
  const f = useFrame();
  const look = annotationLook(t, variant);
  return (
    <Stage>
      <div style={{ position: "absolute", left: PANEL.x, top: 96, width: PANEL.w, minHeight: 150 }}>
        <Eyebrow>{`Señal del sistema: ${look.mark}`}</Eyebrow>
        <div style={{ marginTop: 10, fontSize: t.type.h2 * 0.8, lineHeight: 1.15, ...textStyle(t, "title"), color: t.color.text, opacity: kf(f, [0, 14], [0, 1]) }}>
          Una llamada, <Highlight frame={f} progress={kf(f, [10, 40], [0, 1])}>cinco estéticas</Highlight>
        </div>
      </div>

      {/* Lo demás (panel, fichas que no son el objetivo, filas): con la señal `focus` del design system se atenúa; con cualquier otra, `FocusGroup` no hace nada. */}
      <FocusGroup range={T.callout} variant={variant}>
        <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, ...surfaceStyle(t, "window", { level: "lg" }), background: surfaceStyle(t, "window").background === t.color.surface ? t.color.surfaceAlt : surfaceStyle(t, "window").background, opacity: kf(f, [0, 12], [0, 1]) }} />

        {STATS.map((s, i) => (i === TARGET_INDEX ? null : <Ficha key={s.label} s={s} i={i} />))}
        {FILAS.map((r, i) => (
          <div
            key={r}
            style={{
              position: "absolute", left: PANEL.x + 60, top: PANEL.y + 480 + i * 92, width: PANEL.w - 120, minHeight: 72, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 28px",
              ...surfaceStyle(t, "card", { level: "sm", corner: "control" }), borderRadius: cornerRadius(t, "control"),
              fontSize: t.type.caption, lineHeight: 1.2, color: t.color.text, opacity: kf(f, [14 + i * 4, 28 + i * 4], [0, 1]),
            }}
          >
            {r}
          </div>
        ))}

      </FocusGroup>
      {/* El objetivo va fuera del grupo: nunca se atenúa. */}
      <Ficha s={STATS[TARGET_INDEX]!} i={TARGET_INDEX} />

      {/* La señal: no es un garabato ni una flecha elegida a mano; la forma la decide `style.annotation.mark` del tema (o `variant`, como excepción). */}
      <Callout target={TARGET} text="Subió 12 % en la semana" range={T.callout} within={SAFE} prefer={["below", "above"]} variant={variant} id="demo-callout" />

      <Wash range={T.wash} />
    </Stage>
  );
}

export function AnnotationDemo({ theme = "neutral", variant }: AnnotationDemoProps) {
  const t = typeof theme === "object" ? theme : TEMAS[theme] ?? neutral;
  return (
    <ThemeProvider theme={t}>
      <Escena variant={variant} />
    </ThemeProvider>
  );
}
