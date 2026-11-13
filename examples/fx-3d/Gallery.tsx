import React from "react";
import { Sequence, useFrame } from "../../engine";
import { ThemeProvider, dark, neutral, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import {
  CardFlip, CarouselRing, CubeFold, CubeStack, ExtrudeType, Globe, Helix, IsoCity, LayerExplode, OrbitRings,
  ParticleSphere, PhoneOrbit, TerrainMesh, TorusWire, Tunnel, WaveDots,
} from "../../fx/three";

/** `theme`: "neutral" | "dark" (por defecto neutral); también acepta un objeto Theme (para pruebas). */
export type Fx3dProps = { theme?: "neutral" | "dark" | Theme };

const ACTIVE = 75;
const HOLD = 15;
const SLOT = ACTIVE + HOLD;

const W = 1400, H = 800; // caja de cada efecto, centrada en el cuadro

const ITEMS: { name: string; render: () => React.ReactNode }[] = [
  { name: "Globe", render: () => <Globe width={H} height={H} /> },
  { name: "ParticleSphere", render: () => <ParticleSphere width={H} height={H} /> },
  { name: "CubeStack", render: () => <CubeStack width={H} height={H} /> },
  { name: "CubeFold", render: () => <CubeFold width={H} height={H} /> },
  { name: "Tunnel", render: () => <Tunnel width={W} height={H} /> },
  { name: "TerrainMesh", render: () => <TerrainMesh width={W} height={H} /> },
  { name: "TorusWire", render: () => <TorusWire width={H} height={H} /> },
  { name: "Helix", render: () => <Helix width={H} height={H} /> },
  { name: "OrbitRings", render: () => <OrbitRings width={H} height={H} /> },
  { name: "WaveDots", render: () => <WaveDots width={W} height={H} /> },
  { name: "LayerExplode", render: () => <LayerExplode width={W} height={H} /> },
  { name: "CardFlip", render: () => <CardFlip width={W} height={H} cardWidth={780} cardHeight={500} /> },
  { name: "CarouselRing", render: () => <CarouselRing width={W} height={H} /> },
  { name: "IsoCity", render: () => <IsoCity width={W} height={H} /> },
  { name: "ExtrudeType", render: () => <ExtrudeType width={W} height={H} /> },
  { name: "PhoneOrbit", render: () => <PhoneOrbit width={H} height={H} /> },
];

export const TOTAL_FRAMES = ITEMS.length * SLOT;

function Slot({ name, children }: { name: string; children: React.ReactNode }) {
  const theme = useTheme();
  const frame = useFrame();
  const fade = Math.min(1, frame / 6);
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.color.bg }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, bottom: 20, display: "flex", alignItems: "center", justifyContent: "center", opacity: fade }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: theme.safe.x,
          top: 56,
          fontFamily: theme.font.family,
          fontSize: theme.type.caption,
          fontWeight: theme.font.weights.semibold,
          color: theme.color.text,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: 7, background: theme.color.accent, display: "inline-block" }} />
        <span>{`<${name} />`}</span>
      </div>
    </div>
  );
}

export function Fx3dGallery({ theme = "neutral" }: Fx3dProps) {
  const th: Theme = typeof theme === "object" ? theme : theme === "dark" ? dark : neutral;
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
