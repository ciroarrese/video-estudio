import React from "react";
import { Sequence, useFrame } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import {
  CardFlip, CarouselRing, CubeFold, CubeStack, ExtrudeType, Globe, Helix, IsoCity, LayerExplode, OrbitRings,
  ParticleSphere, PhoneOrbit, TerrainMesh, TorusWire, Tunnel, WaveDots,
} from "../../fx/three";

/** `theme`: nombre de un tema de `themes/` (por defecto neutral); también acepta un objeto Theme (para pruebas). */
export type Fx3dProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme };

const POR_NOMBRE = { neutral, dark, editorial, neon, papel };

const ACTIVE = 75;
const HOLD = 15;
const SLOT = ACTIVE + HOLD;

const W = 1700, H = 940; // caja de cada efecto, centrada en el cuadro (el sujeto ocupa entre 55 y 75 % del alto del cuadro)

const ITEMS: { name: string; render: () => React.ReactNode }[] = [
  { name: "Globe", render: () => <Globe width={H} height={H} /> },
  { name: "ParticleSphere", render: () => <ParticleSphere width={H} height={H} /> },
  { name: "CubeStack", render: () => <CubeStack width={H} height={H} /> },
  { name: "CubeFold", render: () => <CubeFold width={H} height={H} /> },
  { name: "Tunnel", render: () => <Tunnel width={W} height={H} /> },
  { name: "TerrainMesh", render: () => <TerrainMesh width={1920} height={H} /> },
  { name: "TorusWire", render: () => <TorusWire width={H} height={H} /> },
  { name: "Helix", render: () => <Helix width={H} height={H} /> },
  { name: "OrbitRings", render: () => <OrbitRings width={H} height={H} /> },
  { name: "WaveDots", render: () => <WaveDots width={W} height={H} /> },
  { name: "LayerExplode", render: () => <LayerExplode width={W} height={H} /> },
  { name: "CardFlip", render: () => <CardFlip width={W} height={H} cardWidth={980} cardHeight={620} /> },
  { name: "CarouselRing", render: () => <CarouselRing width={W} height={H} /> },
  { name: "IsoCity", render: () => <IsoCity width={W} height={H} /> },
  { name: "ExtrudeType", render: () => <ExtrudeType width={W} height={H} /> },
  { name: "PhoneOrbit", render: () => <PhoneOrbit width={W} height={H} /> },
  { name: "PhoneOrbit con pantalla", render: () => <PhoneOrbit width={W} height={H}><AppScreen /></PhoneOrbit> },
];

/** Interfaz recreada (sin capturas) para la pantalla del teléfono: ocupa toda la caja que da `PhoneOrbit`. */
function AppScreen() {
  const theme = useTheme();
  const fs = theme.type.eyebrow;
  const rows = ["Resumen", "Pendientes", "Equipo", "Calendario", "Ajustes"];
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: 16, display: "flex", flexDirection: "column", gap: 14, background: theme.color.bg, color: theme.color.text, fontSize: fs }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: theme.font.weights.semibold }}>
        <span>Inicio</span>
        <span style={{ width: 26, height: 26, borderRadius: theme.radius.pill, background: theme.color.accent2 }} />
      </div>
      <div style={{ borderRadius: theme.radius.md, background: theme.color.accent, color: theme.color.onAccent, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: Math.round(fs * 0.9) }}>Avance del mes</span>
        <span style={{ fontSize: Math.round(fs * 2.2), fontWeight: theme.font.weights.stat, lineHeight: 1 }}>82 %</span>
      </div>
      {rows.map((r, i) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: theme.radius.md, background: theme.color.surfaceAlt, border: `1px solid ${theme.color.border}` }}>
          <span style={{ width: 30, height: 30, borderRadius: theme.radius.sm, background: i % 2 ? theme.color.accent2 : theme.color.accent, flex: "none" }} />
          <span>{r}</span>
        </div>
      ))}
    </div>
  );
}

export const TOTAL_FRAMES = ITEMS.length * SLOT;

function Slot({ name, children }: { name: string; children: React.ReactNode }) {
  const theme = useTheme();
  const frame = useFrame();
  const fade = Math.min(1, frame / 6);
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.color.bg }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 130, bottom: 10, display: "flex", alignItems: "center", justifyContent: "center", opacity: fade }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: theme.safe.x,
          top: 44,
          fontFamily: theme.font.family,
          fontSize: theme.type.body,
          fontWeight: theme.font.weights.semibold,
          color: theme.color.text,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 11, background: theme.color.accent, display: "inline-block" }} />
        <span>{`<${name} />`}</span>
      </div>
    </div>
  );
}

export function Fx3dGallery({ theme = "neutral" }: Fx3dProps) {
  const th: Theme = typeof theme === "object" ? theme : POR_NOMBRE[theme] ?? neutral;
  return (
    <ThemeProvider theme={th}>
      <div style={{ position: "absolute", inset: 0, background: th.color.bg }}>
        {ITEMS.map((it, i) => (
          <Sequence key={it.name} from={i * SLOT} durationInFrames={SLOT}>
            <Slot name={it.name}>{it.render()}</Slot>
          </Sequence>
        ))}
      </div>
    </ThemeProvider>
  );
}
