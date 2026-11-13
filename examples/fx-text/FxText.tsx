import React from "react";
import { Series, useFrame } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { Stage } from "../../kit";
import {
  DigitRoll, KineticWords, MarqueeBands, MaskedRise, ScrambleDecode, SplitFlap, TypeRing, Typewriter,
} from "../../fx";

/** `theme`: nombre de un tema de `themes/` (por defecto neutral); tambien acepta un objeto Theme. */
export type FxTextProps = { theme?: "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme };

const POR_NOMBRE = { neutral, dark, editorial, neon, papel };

/** Cada efecto dura 75 cuadros mas 15 de pausa con la imagen final. */
export const SEG = 90;
export const SEGMENTS = ["MaskedRise", "KineticWords", "Typewriter", "ScrambleDecode", "SplitFlap", "DigitRoll", "MarqueeBands", "TypeRing"] as const;

function Label({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: theme.safe.x,
        bottom: theme.safe.y - 30,
        fontSize: theme.type.body,
        fontWeight: theme.font.weights.semibold,
        color: theme.color.text,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.pill,
        padding: "10px 32px",
        letterSpacing: "0.02em",
      }}
    >
      {`<${name} />`}
    </div>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
);

function Effect({ name }: { name: (typeof SEGMENTS)[number] }) {
  const theme = useTheme();
  switch (name) {
    case "MaskedRise":
      return <Center><MaskedRise text="Movimiento con intención" fontSize={theme.type.hero} dot align="center" width={1700} /></Center>;
    case "KineticWords":
      return <KineticWords words={["Cuatro", "palabras", "cortes", "secos"]} duration={75} />;
    case "Typewriter":
      return (
        <Center>
          <Typewriter
            text="Escribiendo una idea cada vez."
            duration={60}
            fontSize={theme.type.h1}
            after={
              <span style={{ padding: "6px 22px", borderRadius: theme.radius.pill, background: theme.color.accent, color: theme.color.onAccent, fontSize: theme.type.body, fontWeight: theme.font.weights.semibold }}>
                listo
              </span>
            }
          />
        </Center>
      );
    case "ScrambleDecode":
      return <Center><ScrambleDecode text="Señal descifrada" duration={60} fontSize={theme.type.hero} seed="gallery" /></Center>;
    case "SplitFlap":
      return <Center><SplitFlap text="SALIDAS" fontSize={theme.type.h1} seed="gallery" /></Center>;
    case "DigitRoll":
      return <Center><DigitRoll value={48250} suffix="+" duration={60} fontSize={theme.type.stat * 1.2} /></Center>;
    case "MarqueeBands":
      return <MarqueeBands lines={["Diseño en movimiento", "Cuadro a cuadro", "Todo del tema"]} angle={-7} duration={75} />;
    case "TypeRing":
      return <Center><TypeRing text="Texto en órbita" duration={75} fontSize={theme.type.h1} width={1700} height={720} radius={560} /></Center>;
  }
}

function Showcase() {
  const frame = useFrame();
  const seg = Math.min(SEGMENTS.length - 1, Math.floor(frame / SEG));
  const name = SEGMENTS[seg]!;
  return (
    <Stage clouds={false}>
      <Series>
        {SEGMENTS.map((s) => (
          <Series.Item key={s} durationInFrames={SEG}>
            {s === name && <Effect name={s} />}
          </Series.Item>
        ))}
      </Series>
      <Label name={name} />
    </Stage>
  );
}

export function FxText({ theme = "neutral" }: FxTextProps) {
  const t = typeof theme === "string" ? POR_NOMBRE[theme] ?? neutral : theme;
  return (
    <ThemeProvider theme={t}>
      <Showcase />
    </ThemeProvider>
  );
}
