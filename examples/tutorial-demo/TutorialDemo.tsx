import { Sequence, useFormat, useFrame } from "../../engine";
import { Avatar, Button, Chip, Icon, ListRow, Stage, StepFrame, Wash } from "../../kit";
import type { Rect, StepSignal } from "../../kit";
import { ThemeProvider, borderWidth, dark, editorial, neon, neutral, papel, surfaceStyle, textStyle, useTheme } from "../../themes";
import type { Theme } from "../../themes";

/** Temas que la demo conoce por nombre. */
const TEMAS: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
export type TutorialDemoProps = { theme?: keyof typeof TEMAS | Theme };

// --- Tabla de tiempos (cuadros de cada paso; los pasos corren dentro de un `Sequence`, así que el cuadro es local) ---
const PASO = 150;
export const DURACION = 2 * PASO; // 300 cuadros = 10 s
const T = {
  // paso 1: elegir taller y fecha
  taller: { start: 14, duration: 58, elige: 46 },
  fecha: { start: 76, duration: 62, elige: 112 },
  // paso 2: revisar y confirmar
  total: { start: 14, duration: 58 },
  reservar: { start: 78, duration: 58 },
  veloDe: [PASO - 14, PASO - 1] as [number, number], // cierre del paso 1 (velo)
};

// --- Interfaz recreada, en coordenadas del mundo (1 unidad = 1 px a escala 1; formato horizontal 1920x1080) ---
const VENTANA: Rect = { x: 150, y: 100, w: 1620, h: 880 };
const MENU_W = 300;
const CAMPO = { x: 500, w: 700, h: 88 };
const CAMPOS = {
  taller: { x: CAMPO.x, y: 290, w: CAMPO.w, h: CAMPO.h },
  fecha: { x: CAMPO.x, y: 450, w: CAMPO.w, h: CAMPO.h },
  horario: { x: CAMPO.x, y: 610, w: CAMPO.w, h: CAMPO.h },
};
const BOTON: Rect = { x: CAMPO.x, y: 790, w: 280, h: 80 };
const RESUMEN: Rect = { x: 1260, y: 290, w: 470, h: 420 };
const TOTAL: Rect = { x: RESUMEN.x + 40, y: RESUMEN.y + 290, w: RESUMEN.w - 80, h: 90 };

const TALLER = "Cerámica para principiantes";
const FECHA = "Sábado 12 de abril";

/** Un campo de formulario: rótulo arriba y caja con el valor (o la sugerencia si todavía no hay). */
function Campo({ rect, label, value, hint }: { rect: Rect; label: string; value?: string; hint: string }) {
  const t = useTheme();
  const b = borderWidth(t, "card");
  return (
    <>
      <div style={{ position: "absolute", left: rect.x, top: rect.y - 38, whiteSpace: "nowrap", fontSize: t.type.ui.sm, lineHeight: "28px", color: t.color.textMuted, ...textStyle(t, "label") }}>{label}</div>
      <div
        style={{
          position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxSizing: "border-box", padding: "0 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          ...surfaceStyle(t, "card", { level: "sm", corner: "control" }), ...(b > 0 ? { border: `${b}px solid ${t.color.border}` } : {}),
          fontSize: t.type.ui.md + 4, lineHeight: "36px", color: value ? t.color.text : t.color.textMuted, whiteSpace: "nowrap",
        }}
      >
        <span>{value ?? hint}</span>
        <Icon name="search" size={30} color="textMuted" />
      </div>
    </>
  );
}

/**
 * La interfaz de una agenda de talleres (ficticia). Es una función pura de lo elegido: cada paso la dibuja con los valores que ya tiene.
 */
function Interfaz({ taller, fecha, reservado }: { taller?: string; fecha?: string; reservado: boolean }) {
  const t = useTheme();
  const menu = [
    { icon: "home", title: "Inicio" },
    { icon: "calendar", title: "Agenda", on: true },
    { icon: "document", title: "Reservas" },
    { icon: "message", title: "Mensajes" },
  ] as const;
  return (
    <>
      <div style={{ position: "absolute", left: VENTANA.x, top: VENTANA.y, width: VENTANA.w, height: VENTANA.h, boxSizing: "border-box", ...surfaceStyle(t, "window", { level: "lg" }) }} />
      {/* menú lateral */}
      <div style={{ position: "absolute", left: VENTANA.x + 30, top: VENTANA.y + 130, width: MENU_W - 60, fontSize: t.type.ui.md }}>
        {menu.map((m) => (
          <ListRow key={m.title} title={m.title} on={"on" in m} size={t.type.ui.md + 2} leading={<Icon name={m.icon} size={34} color={"on" in m ? "accent" : "textMuted"} />} style={{ marginBottom: 10, padding: "14px 18px" }} />
        ))}
      </div>
      {/* barra superior */}
      <div style={{ position: "absolute", left: VENTANA.x + 40, top: VENTANA.y + 34, whiteSpace: "nowrap", fontSize: t.type.ui.md + 8, lineHeight: "44px", color: t.color.text, ...textStyle(t, "title") }}>Agenda de talleres</div>
      <div style={{ position: "absolute", right: 1920 - (VENTANA.x + VENTANA.w) + 40, top: VENTANA.y + 28, display: "flex", alignItems: "center", gap: 18 }}>
        <Icon name="bell" size={34} color="textMuted" />
        <Avatar name="Usuaria" index={1} size={52} />
      </div>
      <div style={{ position: "absolute", left: CAMPO.x, top: VENTANA.y + 112, whiteSpace: "nowrap", fontSize: t.type.ui.md + 6, lineHeight: "36px", color: t.color.text, ...textStyle(t, "title") }}>Nueva reserva</div>
      {/* formulario */}
      <Campo rect={CAMPOS.taller} label="Taller" value={taller} hint="Elegí un taller" />
      <Campo rect={CAMPOS.fecha} label="Fecha" value={fecha} hint="Elegí una fecha" />
      <Campo rect={CAMPOS.horario} label="Horario" value="18:30 a 20:30" hint="" />
      <div style={{ position: "absolute", left: BOTON.x, top: BOTON.y, width: BOTON.w, height: BOTON.h, display: "flex" }}>
        <Button size={t.type.ui.md + 4} style={{ width: "100%", justifyContent: "center" }} pressed={reservado ? 1 : 0}>Reservar</Button>
      </div>
      {/* resumen */}
      <div style={{ position: "absolute", left: RESUMEN.x, top: RESUMEN.y, width: RESUMEN.w, height: RESUMEN.h, boxSizing: "border-box", padding: 40, ...surfaceStyle(t, "card", { level: "sm", corner: "panel" }) }}>
        <div style={{ fontSize: t.type.ui.sm, lineHeight: "28px", color: t.color.textMuted, ...textStyle(t, "label") }}>Resumen</div>
        <div style={{ marginTop: 22, fontSize: t.type.ui.md + 2, lineHeight: "34px", color: t.color.text }}>{taller ?? "Sin taller"}</div>
        <div style={{ marginTop: 8, fontSize: t.type.ui.md + 2, lineHeight: "34px", color: t.color.textMuted }}>{fecha ?? "Sin fecha"}</div>
        <div style={{ marginTop: 24 }}><Chip size={t.type.ui.sm} tone="success">Hay cupos</Chip></div>
      </div>
      <div style={{ position: "absolute", left: TOTAL.x, top: TOTAL.y, width: TOTAL.w, height: TOTAL.h, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: t.type.ui.md + 2, color: t.color.text }}>
        <span style={textStyle(t, "label")}>Total</span>
        <span style={{ fontWeight: t.font.weights.stat }}>$ 18.500</span>
      </div>
    </>
  );
}

const PASO_1: StepSignal[] = [
  { id: "taller", target: CAMPOS.taller, start: T.taller.start, duration: T.taller.duration, label: "Elegí el taller", labelSide: "below" },
  {
    id: "fecha", target: CAMPOS.fecha, start: T.fecha.start, duration: T.fecha.duration, label: "Elegí la fecha", labelSide: "below",
    card: { label: "Cupos libres", value: "12 de 20", side: "right" },
  },
];
const PASO_2: StepSignal[] = [
  { id: "total", target: TOTAL, start: T.total.start, duration: T.total.duration, label: "Revisá el total", card: { label: "Total a pagar", value: "$ 18.500", side: "left" } },
  { id: "reservar", target: BOTON, start: T.reservar.start, duration: T.reservar.duration, label: "Confirmá con este botón" },
];

function Paso({ index, signals }: { index: 0 | 1; signals: StepSignal[] }) {
  const f = useFrame();
  const { width, height } = useFormat();
  const eligio = {
    taller: index === 1 || f >= T.taller.elige ? TALLER : undefined,
    fecha: index === 1 || f >= T.fecha.elige ? FECHA : undefined,
  };
  return (
    <>
      <StepFrame
        overview={{ x: width / 2, y: height / 2 }}
        zoom={{ in: 1.6 }}
        step={{ index, count: 2, duration: PASO }}
        signals={signals}
      >
        <Interfaz taller={eligio.taller} fecha={eligio.fecha} reservado={index === 1 && f >= T.reservar.start + 36} />
      </StepFrame>
      {index === 0 ? <Wash range={T.veloDe} /> : null}
    </>
  );
}

/** Dos pasos seguidos (10 s): cada uno es un `Sequence`, así que sus tiempos son locales y la tabla `T` se lee de arriba abajo. */
export function TutorialDemo({ theme = "neutral" }: TutorialDemoProps) {
  const th = typeof theme === "string" ? TEMAS[theme]! : theme;
  return (
    <ThemeProvider theme={th}>
      <Stage clouds={false}>
        <Sequence from={0} durationInFrames={PASO}><Paso index={0} signals={PASO_1} /></Sequence>
        <Sequence from={PASO} durationInFrames={PASO}><Paso index={1} signals={PASO_2} /></Sequence>
      </Stage>
    </ThemeProvider>
  );
}
