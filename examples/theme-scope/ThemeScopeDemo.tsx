import { useFrame } from "../../engine";
import { ThemeProvider, dark, neutral, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { CountUp, Cursor, DockedHeadline, Stage, ThemeScope, kf } from "../../kit";
import { DonutRing, Typewriter } from "../../fx";
import { ParticleSphere } from "../../fx/three";

type Named = "neutral" | "dark" | Theme;
/** `theme`: tema del video. `scoped`: tema de la herramienta recreada (por defecto el contrario). Aceptan un objeto Theme (para pruebas). */
export type ThemeScopeDemoProps = { theme?: Named; scoped?: Named; inner?: Named };

const resolve = (t: Named): Theme => (typeof t === "object" ? t : t === "dark" ? dark : neutral);

/** Tarjeta de estadística: sale entera de `useTheme()`, así que toma el tema del ámbito donde se la ponga. */
function Stat({ label, value, to, left }: { label: string; value: string; to: number; left: number }) {
  const theme = useTheme();
  const frame = useFrame();
  return (
    <div style={{ position: "absolute", left, top: 120, width: 230, height: 150, boxSizing: "border-box", padding: "18px 22px", background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, boxShadow: theme.shadow.sm }}>
      <div style={{ fontSize: theme.type.eyebrow, color: theme.color.textMuted }}>{label}</div>
      <div style={{ fontSize: 64, lineHeight: 1.15, fontWeight: theme.font.weights.stat, color: theme.color.text }}>
        <CountUp frame={frame} from={0} to={to} start={20} duration={40} />
        <span style={{ fontSize: theme.type.body, color: theme.color.accent }}>{value}</span>
      </div>
    </div>
  );
}

function Tool({ inner }: { inner: Theme }) {
  const theme = useTheme();
  const frame = useFrame();
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 36, top: 28, fontSize: theme.type.body, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>Herramienta de ejemplo</div>
      <div style={{ position: "absolute", left: 36, top: 76, fontSize: theme.type.caption, color: theme.color.textMuted }}>
        <Typewriter frame={frame} start={8} duration={40} text="Tablero con su propio tema" fontSize={theme.type.caption} />
      </div>
      <Stat label="Nuevos" value=" %" to={128} left={36} />
      <Stat label="Cerrados" value=" %" to={87} left={290} />
      <div style={{ position: "absolute", left: 560, top: 70, width: 260, height: 260 }}>
        <DonutRing frame={frame} start={10} duration={60} width={260} height={260} value={72} label="Avance" />
      </div>
      <div style={{ position: "absolute", left: 36, top: 300, width: 330, height: 330, borderRadius: theme.radius.panel, overflow: "hidden", background: theme.color.surfaceAlt, border: `1px solid ${theme.color.border}` }}>
        <ParticleSphere frame={frame} start={0} duration={75} width={330} height={330} />
      </div>
      {/* Subárbol anidado: vuelve al otro tema, dentro de la herramienta. */}
      <ThemeScope theme={inner} paint style={{ position: "absolute", left: 400, top: 340, width: 420, height: 280, borderRadius: theme.radius.panel, border: `1px solid ${inner.color.border}`, padding: 28, boxSizing: "border-box" }}>
        <InnerNote />
      </ThemeScope>
      <Cursor frame={frame} show={[30, 120]} keys={[[30, 700, 560], [80, 330, 160], [120, 340, 170]]} clicks={[82]} />
    </div>
  );
}

function InnerNote() {
  const theme = useTheme();
  return (
    <>
      <div style={{ fontSize: theme.type.body, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>Nota anidada</div>
      <div style={{ marginTop: 10, fontSize: theme.type.caption, color: theme.color.textMuted }}>Otro ámbito, dentro del ámbito de la herramienta.</div>
      <div style={{ marginTop: 18, display: "inline-block", padding: "8px 20px", borderRadius: theme.radius.pill, background: theme.color.accent, color: theme.color.onAccent, fontSize: theme.type.caption, fontWeight: theme.font.weights.semibold }}>Listo</div>
    </>
  );
}

function Scene({ scoped, inner }: { scoped: Theme; inner: Theme }) {
  const frame = useFrame();
  const theme = useTheme();
  return (
    <Stage clouds={false}>
      <DockedHeadline index={1} title="Un tema por escena" subtitle="La herramienta oscura dentro de un video claro" frame={frame} start={0} />
      <div style={{ position: "absolute", left: 500, top: 190, opacity: kf(frame, [0, 20], [0, 1]) }}>
        <ThemeScope theme={scoped} paint style={{ width: 860, height: 660, borderRadius: theme.radius.lg, border: `1px solid ${scoped.color.border}`, boxShadow: scoped.shadow.lg, overflow: "hidden" }}>
          <Tool inner={inner} />
        </ThemeScope>
      </div>
      <div style={{ position: "absolute", left: theme.safe.x, top: 900, fontSize: theme.type.caption, color: theme.color.textMuted }}>Fuera del ámbito: tema del video ({theme.name})</div>
    </Stage>
  );
}

/** Cambio de tema por escena y por subárbol con `ThemeScope`: una herramienta oscura recreada dentro de un video claro, con un ámbito anidado. */
export function ThemeScopeDemo({ theme = "neutral", scoped, inner }: ThemeScopeDemoProps) {
  const outer = resolve(theme);
  const mid = scoped ? resolve(scoped) : outer === dark ? neutral : dark;
  const inn = inner ? resolve(inner) : outer;
  return (
    <ThemeProvider theme={outer}>
      <Scene scoped={mid} inner={inn} />
    </ThemeProvider>
  );
}
