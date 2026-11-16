import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, dark } from "../themes";
import type { Theme } from "../themes";
import * as fx from "./index";

/**
 * Principio de `docs/animaciones.md`: antes de `start` un efecto no deja nada a la vista (ni texto ni formas). Se prueba para todo el catálogo:
 * se monta con `start` en el futuro y se busca texto visible, es decir texto cuyo ancestro no esté oculto (`opacity` 0, `visibility: hidden`,
 * `display: none` o el atributo `opacity="0"` de SVG).
 */
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 2000 };
const START = 60;

const html = (node: React.ReactNode, theme: Theme, frame: number) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

function oculto(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const st = (e.getAttribute("style") ?? "").replace(/\s+/g, "");
    if (/(^|;)opacity:0(;|$)/.test(st) || /visibility:hidden/.test(st) || /display:none/.test(st)) return true;
    if (e.getAttribute("opacity") === "0" || e.getAttribute("display") === "none") return true;
  }
  return false;
}

function textoVisible(markup: string): string[] {
  const doc = new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      const t = (n.textContent ?? "").trim();
      if (t && n.parentElement && !oculto(n.parentElement)) out.push(t);
    } else n.childNodes.forEach(walk);
  };
  walk(doc.body);
  return out;
}

// Efectos con texto a la vista: props mínimas para que dibujen contenido. Los que dibujan solo formas se prueban con el mismo método (sin texto no hay nada que listar).
const casos: [string, (f: number) => React.ReactNode][] = [
  ["LineDraw", (f) => <fx.LineDraw frame={f} start={START} />],
  ["DonutRing", (f) => <fx.DonutRing frame={f} start={START} />],
  ["RadarMorph", (f) => <fx.RadarMorph frame={f} start={START} />],
  ["Bars3D", (f) => <fx.Bars3D frame={f} start={START} />],
  ["BarsGrow", (f) => <fx.BarsGrow frame={f} start={START} />],
  ["FlowSteps", (f) => <fx.FlowSteps frame={f} start={START} />],
  ["NotificationStack", (f) => <fx.NotificationStack frame={f} start={START} />],
  ["ChatThread", (f) => <fx.ChatThread frame={f} start={START} />],
  ["CommandPalette", (f) => <fx.CommandPalette frame={f} start={START} />],
  ["CardFan", (f) => <fx.CardFan frame={f} start={START} />],
  ["PhoneScroll", (f) => <fx.PhoneScroll frame={f} start={START} />],
  ["PhoneFrame", (f) => <fx.PhoneFrame frame={f} start={START}>contenido</fx.PhoneFrame>],
  ["BeforeAfter", (f) => <fx.BeforeAfter frame={f} start={START} />],
  ["TileGrid", (f) => <fx.TileGrid frame={f} start={START} />],
  ["TileDone", (f) => <fx.TileDone frame={f} start={START} duration={30} />],
  ["BlueprintDraw", (f) => <fx.BlueprintDraw frame={f} start={START} />],
  ["MarkerDraw", (f) => <fx.MarkerDraw frame={f} start={START} kind="circle" />],
  ["PaperCollage", (f) => <fx.PaperCollage frame={f} start={START} />],
  ["ShapeMorph", (f) => <fx.ShapeMorph frame={f} start={START} />],
  ["DotWipe", (f) => <fx.DotWipe frame={f} start={START} />],
  ["HalftoneWave", (f) => <fx.HalftoneWave frame={f} start={START} />],
  ["PixelBuild", (f) => <fx.PixelBuild frame={f} start={START} />],
  ["LogoLand", (f) => <fx.LogoLand frame={f} start={START} />],
  ["LiquidBlob", (f) => <fx.LiquidBlob frame={f} start={START} />],
  ["SealSpin", (f) => <fx.SealSpin frame={f} start={START} />],
  ["RibbonTwist", (f) => <fx.RibbonTwist frame={f} start={START} />],
  ["MaskedRise", (f) => <fx.MaskedRise frame={f} start={START} text="Hola mundo" />],
  ["KineticWords", (f) => <fx.KineticWords frame={f} start={START} words={["uno", "dos"]} />],
  ["Typewriter", (f) => <fx.Typewriter frame={f} start={START} text="Hola mundo" />],
  ["ScrambleDecode", (f) => <fx.ScrambleDecode frame={f} start={START} text="Hola mundo" />],
  ["SplitFlap", (f) => <fx.SplitFlap frame={f} start={START} text="HOLA" />],
  ["DigitRoll", (f) => <fx.DigitRoll frame={f} start={START} value={1234} />],
  ["MarqueeBands", (f) => <fx.MarqueeBands frame={f} start={START} lines={["uno", "dos"]} />],
  ["TypeRing", (f) => <fx.TypeRing frame={f} start={START} text="HOLA MUNDO" />],
  ["Globe", (f) => <fx.Globe frame={f} start={START} />],
  ["CubeStack", (f) => <fx.CubeStack frame={f} start={START} />],
  ["CubeFold", (f) => <fx.CubeFold frame={f} start={START} />],
  ["CardFlip", (f) => <fx.CardFlip frame={f} start={START} />],
  ["CarouselRing", (f) => <fx.CarouselRing frame={f} start={START} />],
  ["LayerExplode", (f) => <fx.LayerExplode frame={f} start={START} />],
  ["ExtrudeType", (f) => <fx.ExtrudeType frame={f} start={START} text="Hola" />],
  ["PhoneOrbit", (f) => <fx.PhoneOrbit frame={f} start={START} />],
  ["IsoCity", (f) => <fx.IsoCity frame={f} start={START} />],
];

/**
 * Efectos que esconden el texto con una máscara (`overflow: hidden` y la letra desplazada fuera de la caja): antes de `start` cada letra está
 * debajo de su máscara, que no se ve. Se comprueba esa estructura en lugar de la opacidad.
 */
const enmascarados = new Set(["MaskedRise", "KineticWords"]);

function letrasEnmascaradas(markup: string): boolean {
  const doc = new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
  const tw = Array.from(doc.body.querySelectorAll("span")).filter((e) => e.children.length === 0 && (e.textContent ?? "").trim() !== "");
  return tw.length > 0 && tw.every((e) => /transform:translateY\(\d/.test((e.getAttribute("style") ?? "").replace(/\s+/g, "")) && /overflow:hidden/.test((e.parentElement?.getAttribute("style") ?? "").replace(/\s+/g, "")));
}

describe("catálogo fx: antes de `start` no hay texto a la vista", () => {
  for (const [name, mk] of casos) {
    for (const [tn, theme] of [["neutral", neutral], ["dark", dark]] as const) {
      it(`${name} (${tn})`, () => {
        for (const f of [0, 20, START - 1]) {
          if (enmascarados.has(name)) {
            expect(letrasEnmascaradas(html(mk(f), theme, f)), `${name}: las letras tienen que estar bajo su máscara antes de start (cuadro ${f})`).toBe(true);
            continue;
          }
          const visible = textoVisible(html(mk(f), theme, f));
          expect(visible, `${name} muestra texto antes de start (cuadro ${f})`).toEqual([]);
        }
      });
    }
  }
});
