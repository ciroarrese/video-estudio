import { useFormat, useFrame } from "../../engine";
import { ThemeProvider, cornerRadius, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { CountUp, Cursor, DockedHeadline, Stage, ThemeScope, headlineStrip, kf, textWidth } from "../../kit";
import { DonutRing, Typewriter } from "../../fx";
import { ParticleSphere } from "../../fx/three";
import { ESTADOS } from "./estados";

type Named = "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme;
/** `theme`: tema del video. `scoped`: tema de la herramienta recreada (por defecto el contrario). Aceptan un objeto Theme (para pruebas). */
export type ThemeScopeDemoProps = { theme?: Named; scoped?: Named; inner?: Named };

const resolve = (t: Named): Theme => (typeof t === "object" ? t : ESTADOS[t] ?? ESTADOS.neutral);

/**
 * Tarjeta de estadística: sale entera de `useTheme()`, así que toma el tema del ámbito donde se la ponga.
 * Es una caja en flujo (`minWidth` / `minHeight` y `lineHeight` explícitos): con otra tipografía crece en vez de desbordar.
 */
function Stat({ label, value, to }: { label: string; value: string; to: number }) {
  const theme = useTheme();
  const frame = useFrame();
  return (
    <div style={{ minWidth: 230, minHeight: 150, boxSizing: "border-box", padding: "18px 22px", background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: cornerRadius(theme, "control"), boxShadow: theme.shadow.sm }}>
      <div style={{ fontSize: theme.type.eyebrow, lineHeight: 1.2, color: theme.color.textMuted }}>{label}</div>
      <div style={{ fontSize: 64, lineHeight: 1.15, whiteSpace: "nowrap", fontWeight: theme.font.weights.stat, color: theme.color.text }}>
        <CountUp frame={frame} from={0} to={to} start={20} duration={40} />
        <span style={{ fontSize: theme.type.body, color: theme.color.accent }}>{value}</span>
      </div>
    </div>
  );
}

/** Ancho de la ventana de la herramienta y alto mínimo (la ventana crece si el contenido lo pide). */
const WIN = { w: 1060, h: 660 };
const TITULO = "Herramienta de ejemplo";

function Tool({ inner }: { inner: Theme }) {
  const theme = useTheme();
  const frame = useFrame();
  // Las pastillas de estado van a la derecha del título, a una distancia medida (no a un x fijo): si el título se ensancha las empuja, y si no hay lugar bajan.
  const tituloW = textWidth(theme, TITULO, { size: theme.type.body, weight: "semibold" });
  const chipsGap = Math.max(40, 564 - tituloW);
  return (
    <div style={{ position: "relative", minHeight: WIN.h, boxSizing: "border-box", padding: "28px 36px 30px" }}>
      {/* Columna en flujo: título (con las pastillas al lado), subtítulo, tarjetas y esfera. Cada bloque tiene un alto mínimo igual al de antes. */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", columnGap: chipsGap, rowGap: 8, minHeight: 48 }}>
        <div style={{ fontSize: theme.type.body, lineHeight: 1.1, fontWeight: theme.font.weights.semibold, color: theme.color.text, whiteSpace: "nowrap" }}>{TITULO}</div>
        {/* Colores de datos del tema del ámbito (`theme.data`): solo si el tema los declara. El texto de cada pastilla lleva el color de estado sobre la ficha: por eso el dato se verifica contra `fichaFondo` (ver estados.ts). */}
        {"estadoOk" in theme.data && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {([["Ok", theme.data.estadoOk], ["Alerta", theme.data.estadoAlerta], ["Fallo", theme.data.estadoFallo]] as const).map(([t, c]) => (
              <span key={t} style={{ padding: "2px 12px", borderRadius: cornerRadius(theme, "chip"), background: theme.data.fichaFondo, border: `2px solid ${c}`, color: c, fontSize: theme.type.ui.sm, lineHeight: 1.25, whiteSpace: "nowrap", fontWeight: theme.font.weights.semibold }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      {/* Cuerpo en flujo, en dos filas (si no hay ancho para dos cosas una al lado de la otra, la segunda baja): arriba, subtítulo y tarjetas con el anillo al costado;
          abajo, la esfera y la nota anidada. Nada va a un x o un y fijo: lo que crece con otra tipografía empuja a lo que tiene debajo y la ventana se alarga. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 24, rowGap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 600px", minWidth: 0 }}>
            <div style={{ minHeight: 44, fontSize: theme.type.caption, lineHeight: 1.2, color: theme.color.textMuted }}>
              <Typewriter frame={frame} start={8} duration={40} text="Tablero con su propio tema" fontSize={theme.type.caption} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, minHeight: 150 }}>
              <Stat label="Nuevos" value=" %" to={128} />
              <Stat label="Cerrados" value=" %" to={87} />
            </div>
          </div>
          <div style={{ flex: "0 0 250px" }}>
            <DonutRing frame={frame} start={10} duration={60} width={250} height={250} value={72} label="Avance" />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 24, rowGap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 300px", height: 300, borderRadius: cornerRadius(theme, "panel"), overflow: "hidden", background: theme.color.surfaceAlt, border: `1px solid ${theme.color.border}`, boxSizing: "content-box" }}>
            <ParticleSphere frame={frame} start={0} duration={75} width={300} height={300} />
          </div>
          {/* Subárbol anidado: vuelve al otro tema, dentro de la herramienta. */}
          <ThemeScope theme={inner} paint style={{ flex: "1 1 360px", minWidth: 0, minHeight: 240, borderRadius: cornerRadius(inner, "panel"), border: `1px solid ${inner.color.border}`, padding: 28, boxSizing: "border-box" }}>
            <InnerNote />
          </ThemeScope>
        </div>
      </div>
      <Cursor frame={frame} show={[30, 120]} keys={[[30, 700, 560], [80, 330, 160], [120, 340, 170]]} clicks={[82]} />
    </div>
  );
}

function InnerNote() {
  const theme = useTheme();
  return (
    <>
      <div style={{ fontSize: theme.type.body, lineHeight: 1.2, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>Nota anidada</div>
      <div style={{ marginTop: 10, fontSize: theme.type.caption, lineHeight: 1.2, color: theme.color.textMuted }}>Otro ámbito, dentro del ámbito de la herramienta.</div>
      <div style={{ marginTop: 18, display: "inline-block", padding: "8px 20px", borderRadius: cornerRadius(theme, "chip"), background: theme.color.accent, color: theme.color.onAccent, fontSize: theme.type.caption, lineHeight: 1.2, fontWeight: theme.font.weights.semibold }}>Listo</div>
    </>
  );
}

function Scene({ scoped, inner }: { scoped: Theme; inner: Theme }) {
  const frame = useFrame();
  const theme = useTheme();
  const { width, height } = useFormat();
  // La ventana empieza debajo de la franja del titular (190 si el titular entra ahí, y si no, donde termine); el pie va en flujo bajo la ventana, no a un y fijo.
  const strip = headlineStrip(theme, { width, height });
  const top = Math.max(190, strip.h);
  return (
    <Stage clouds={false}>
      <DockedHeadline index={1} title="Un tema por escena" subtitle="La herramienta oscura dentro de un video claro" frame={frame} start={0} />
      <div style={{ position: "absolute", left: theme.safe.x, top, opacity: kf(frame, [0, 20], [0, 1]) }}>
        <ThemeScope theme={scoped} paint style={{ marginLeft: 500 - theme.safe.x, width: WIN.w, borderRadius: cornerRadius(scoped, "window"), border: `1px solid ${scoped.color.border}`, boxShadow: scoped.shadow.lg, overflow: "hidden" }}>
          <Tool inner={inner} />
        </ThemeScope>
        <div style={{ marginTop: 20, fontSize: theme.type.caption, lineHeight: 1.2, color: theme.color.textMuted }}>Fuera del ámbito: tema del video ({theme.name})</div>
      </div>
    </Stage>
  );
}

/** Cambio de tema por escena y por subárbol con `ThemeScope`: una herramienta oscura recreada dentro de un video claro, con un ámbito anidado. */
export function ThemeScopeDemo({ theme = "neutral", scoped, inner }: ThemeScopeDemoProps) {
  const outer = resolve(theme);
  const mid = scoped ? resolve(scoped) : outer.name === "dark" ? resolve("neutral") : resolve("dark");
  const inn = inner ? resolve(inner) : outer;
  return (
    <ThemeProvider theme={outer}>
      <Scene scoped={mid} inner={inn} />
    </ThemeProvider>
  );
}
