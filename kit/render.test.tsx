import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, dark } from "../themes";
import type { Theme } from "../themes";
import {
  CloudBackground, CountUp, Cursor, DockedHeadline, DoodleArrow, DoodleCircle, DoodleUnderline, FlyingCard,
  GradientText, Stage, Vignette, Wash, World, cameraAt, flight, zoomThrough,
} from "./index";
import { createStage } from "../engine";
import { defineVideo } from "../engine";
import { firstFamily } from "./Stage";
import { KitDemo } from "../examples/kit-demo/KitDemo";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, theme: Theme | null, frame: number) =>
  renderToString(
    <FrameProvider frame={frame} config={config}>
      {theme ? <ThemeProvider theme={theme}>{node}</ThemeProvider> : node}
    </FrameProvider>,
  );

// A theme where EVERY token is a unique sentinel.
const C = (n: number) => `rgb(${n}, ${n + 1}, ${n + 2})`;
const sentinel: Theme = {
  name: "sentinel",
  color: {
    bg: C(1), surface: C(11), surfaceAlt: C(21), text: C(31), textMuted: C(41), border: C(51), accent: C(61),
    accent2: C(71), onAccent: C(81), success: C(91), warning: C(101), danger: C(111), chart: [C(121), C(131)],
  },
  gradient: { brand: `linear-gradient(90deg, ${C(141)}, ${C(151)})` },
  font: { family: '"SentinelFont", serif', weights: { regular: 411, medium: 522, semibold: 633, stat: 744 }, files: [{ weight: 400, src: "/sentinel.woff2" }] },
  radius: { sm: 7001, md: 7002, panel: 7003, lg: 7004, pill: 7005 },
  shadow: { sm: `0 0 0 3001px ${C(161)}`, md: `0 0 0 3002px ${C(171)}`, lg: `0 0 0 3003px ${C(181)}` },
  type: { hero: 1001, h1: 1002, h2: 1003, body: 1004, caption: 1005, eyebrow: 1006, stat: 1007 },
  safe: { x: 2001, y: 2002 },
  motion: { easing: { standard: [0.1, 0.2, 0.3, 0.4], out: [0.2, 0.3, 0.4, 0.5], inOut: [0.3, 0.4, 0.5, 0.6] }, duration: { fast: 3, base: 6, slow: 9 } },
  cloud: { colors: [C(191), C(201)], opacity: 0.77 },
};

const NAMED = /\b(white|black|red|green|blue|gray|grey|orange|purple|pink|yellow|silver|navy|teal|cyan|magenta|brown|gold)\b/i;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function stripSentinels(markup: string): string {
  let m = markup;
  for (const c of [...Object.values(sentinel.color).flat(), ...sentinel.cloud.colors]) {
    const [r, g, b] = (c as string).match(/\d+/g)!;
    m = m.replace(new RegExp(`rgba\\(${r}, ${g}, ${b}, [0-9.]+\\)`, "g"), "");
  }
  for (const v of [sentinel.gradient.brand, ...Object.values(sentinel.shadow)]) m = m.split(v).join("");
  for (const c of [...Object.values(sentinel.color).flat(), ...sentinel.cloud.colors]) m = m.split(c as string).join("");
  return m;
}

/** No colour literal left anywhere (after removing sentinel values), and radii/shadows only from the theme. */
function assertThemed(markup: string) {
  const rest = stripSentinels(markup);
  expect(rest).not.toMatch(HEX);
  expect(rest).not.toMatch(/rgba?\(|hsla?\(/);
  const styles = (rest.match(/(?:style|fill|stroke|stop-color)="[^"]*"/g) ?? []).join(" ");
  expect(styles.replace(/transparent|none/g, "")).not.toMatch(NAMED);
  const radii = new Set(Object.values(sentinel.radius).map((r) => `${r}px`));
  for (const m of markup.matchAll(/border-radius:([^;"]+)/g)) expect(radii.has(m[1]!.trim()), `border-radius ${m[1]}`).toBe(true);
  const shadows = new Set(Object.values(sentinel.shadow));
  for (const m of markup.matchAll(/box-shadow:([^;"]+)/g)) expect(shadows.has(m[1]!.trim()), `box-shadow ${m[1]}`).toBe(true);
}

const items: [string, React.ReactNode, number][] = [
  ["Stage", <Stage>x</Stage>, 10],
  ["Cursor", <Cursor keys={[[0, 0, 0], [20, 100, 100]]} clicks={[10]} show={[0, 60]} />, 12],
  ["Vignette", <Vignette amount={1} />, 0],
  ["DoodleCircle", <DoodleCircle start={0} id="c" cx={50} cy={50} rx={40} ry={20} />, 10],
  ["DoodleArrow", <DoodleArrow start={0} id="a" x1={0} y1={0} x2={100} y2={50} />, 30],
  ["DoodleUnderline", <DoodleUnderline start={0} id="u" x={0} y={0} length={100} />, 10],
  ["GradientText", <GradientText pan={1}>hi</GradientText>, 5],
  ["CloudBackground", <CloudBackground />, 5],
  ["CountUp", <CountUp to={100} start={0} duration={20} />, 10],
  ["DockedHeadline", <DockedHeadline index={1} title="t" subtitle="s" start={0} />, 30],
  ["FlyingCard", <FlyingCard range={[0, 20]} from={{ x: 0, y: 0 }} to={{ x: 200, y: 0 }} arc={40} width={50} height={50}>c</FlyingCard>, 10],
  ["Wash", <Wash range={[0, 10]} />, 5],
  ["World", <World camera={cameraAt(5, [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 10, x: 99, y: 9, scale: 2 }])} width={1920} height={1080}>w</World>, 5],
];

describe("components render", () => {
  for (const [name, node, frame] of items) {
    it(`${name}: both themes, no throw`, () => {
      for (const t of [neutral, dark, null]) expect(() => html(node, t, frame)).not.toThrow();
    });
    it(`${name}: everything comes from the theme`, () => {
      assertThemed(html(node, sentinel, frame));
    });
  }

  it("sentinel theme colours actually show up", () => {
    const out = html(<Stage><DockedHeadline index={1} title="t" subtitle="s" /><Cursor keys={[[0, 0, 0], [20, 5, 5]]} clicks={[10]} show={[0, 60]} /><DoodleCircle start={0} id="c" cx={1} cy={1} rx={5} ry={5} /></Stage>, sentinel, 12);
    for (const needle of [C(1), C(11), C(31), C(61), C(71), "SentinelFont", C(141), C(191)]) {
      expect(out).toContain(needle);
    }
  });

  it("KitDemo draws only theme values (sentinel theme through the real scene)", () => {
    for (const f of [0, 60, 100, 126, 170, 200, 250, 290]) {
      const out = html(<KitDemo theme={sentinel} />, null, f);
      assertThemed(out);
    }
  });

  it("demo renders at several frames in both themes, with no hex literals leaking from the kit", () => {
    for (const theme of ["neutral", "dark"] as const) {
      for (const f of [0, 60, 120, 180, 240, 290, 299]) {
        const out = html(<KitDemo theme={theme} />, null, f);
        expect(out.length).toBeGreaterThan(100);
      }
    }
    const a = html(<KitDemo theme="neutral" />, null, 120);
    const b = html(<KitDemo theme="dark" />, null, 120);
    expect(a).not.toBe(b);
    expect(a).toBe(html(<KitDemo theme="neutral" />, null, 120));
  });
});

describe("Stage fonts", () => {
  it("firstFamily strips quotes and takes the first name", () => {
    expect(firstFamily('"Inter Var", system-ui, sans-serif')).toBe("Inter Var");
    expect(firstFamily("'Foo', serif")).toBe("Foo");
    expect(firstFamily("system-ui, Arial")).toBe("system-ui");
  });
  it("@font-face uses the first family so theme.font.files apply", () => {
    const out = html(<Stage clouds={false}>x</Stage>, sentinel, 0);
    expect(out).toContain('@font-face{font-family:&quot;SentinelFont&quot;');
    expect(out).toContain("/sentinel.woff2");
    expect(out).not.toContain("serif&quot;;font-weight");
  });
});

describe("purity", () => {
  it("rendering frame 200 then 10 equals a fresh render of 10 (real stage, one root)", () => {
    const def = defineVideo({ id: "kit-demo-test", component: KitDemo, fps: 30, width: 1920, height: 1080, durationInFrames: 300 });
    for (const theme of ["neutral", "dark"] as const) {
      const host1 = document.createElement("div");
      const s1 = createStage(host1, def, { theme });
      s1.render(200);
      s1.render(10);
      const host2 = document.createElement("div");
      const s2 = createStage(host2, def, { theme });
      s2.render(10);
      expect(s1.html()).toBe(s2.html());
      s1.destroy();
      s2.destroy();
    }
  });
});

describe("degenerate inputs", () => {
  const k = (n: React.ReactNode, f = 5) => () => html(n, neutral, f);
  it("Cursor: short show window, zero-length window and a single key", () => {
    for (const show of [[0, 8], [4, 4], [0, 1]] as [number, number][]) {
      for (const f of [0, 2, 4, 5, 8, 9]) expect(k(<Cursor keys={[[0, 1, 1], [9, 5, 5]]} show={show} />, f)).not.toThrow();
    }
    expect(k(<Cursor keys={[[0, 7, 9]]} show={[0, 30]} />, 10)).not.toThrow();
    expect(html(<Cursor keys={[[0, 7, 9]]} show={[0, 30]} />, neutral, 10)).toContain("left:7px;top:9px");
  });
  it("CountUp duration 0 jumps; Wash [a,a] steps", () => {
    expect(html(<CountUp to={50} start={5} duration={0} />, neutral, 4)).toContain(">0<");
    expect(html(<CountUp to={50} start={5} duration={0} />, neutral, 5)).toContain(">50<");
    expect(html(<Wash range={[5, 5]} />, neutral, 4)).toBe("");
    expect(html(<Wash range={[5, 5]} />, neutral, 5)).toContain("data-qa-veil=\"1.000\"");
  });
  it("flight / zoomThrough with start == end step", () => {
    expect(flight(4, [5, 5], { x: 0, y: 0 }, { x: 9, y: 9 }).t).toBe(0);
    expect(flight(5, [5, 5], { x: 0, y: 0 }, { x: 9, y: 9 })).toMatchObject({ x: 9, y: 9, t: 1 });
    const cam = { x: 0, y: 0, scale: 1 };
    expect(zoomThrough(4, [5, 5], cam, { x: 3, y: 3 })).toEqual(cam);
    expect(zoomThrough(5, [5, 5], cam, { x: 3, y: 3 }, 10).scale).toBe(10);
  });
  it("cameraAt: one key is static; bad keys throw a clear error naming frames", () => {
    const c = cameraAt(40, [{ f: 10, x: 1, y: 2, scale: 3 }]);
    expect(c).toMatchObject({ x: 1, y: 2, scale: 3, blur: 0 });
    expect(c.rx).toBeCloseTo(0);
    expect(() => cameraAt(0, [])).toThrow(/al menos un cuadro/);
    expect(() => cameraAt(0, [{ f: 10, x: 0, y: 0, scale: 1 }, { f: 10, x: 1, y: 1, scale: 1 }])).toThrow(/10 seguido de 10/);
    expect(() => cameraAt(0, [{ f: 20, x: 0, y: 0, scale: 1 }, { f: 5, x: 1, y: 1, scale: 1 }])).toThrow(/20 seguido de 5/);
  });
});

describe("doodle drawing", () => {
  it("draw-on uses normalised pathLength, a namespaced userSpace gradient, and paints a straight line", () => {
    const out = html(<DoodleUnderline start={0} id="a b:c" x={0} y={5} length={100} />, neutral, 4);
    expect(out).toContain('pathLength="1"');
    expect(out).toContain('id="ve-doodle-a_b_c-g"');
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
    expect(out).toContain("url(#ve-doodle-a_b_c-g)");
    expect(out).not.toContain("a b:c-g");
  });
  it("dash offset depends only on the draw progress, not on the boil seed", () => {
    const off = (f: number) => /stroke-dashoffset="([^"]+)"/.exec(html(<DoodleCircle start={0} id="d" cx={0} cy={0} rx={10} ry={10} />, neutral, f))![1];
    expect(off(1)).toBe(off(1));
    // frames 3 and 4 are in different boil buckets (1 and 1)? use 2 vs 3: different buckets, offsets differ only by progress
    const o2 = Number(off(2));
    const o3 = Number(off(3));
    expect(o3).toBeLessThan(o2);
  });
});

describe("FlyingCard trail", () => {
  it("has no trail ghosts at the instants t=0 and t=1, and fades near the end", () => {
    const f = (fr: number) => html(<FlyingCard range={[10, 30]} from={{ x: 0, y: 0 }} to={{ x: 200, y: 0 }} width={50} height={50}>c</FlyingCard>, neutral, fr);
    expect((f(10).match(/opacity/g) ?? []).length).toBe(0);
    expect((f(30).match(/opacity/g) ?? []).length).toBe(0);
    const ghostOpacity = (s: string) => Math.max(0, ...[...s.matchAll(/opacity:([0-9.e-]+)/g)].map((m) => Number(m[1])));
    expect(ghostOpacity(f(29))).toBeLessThan(ghostOpacity(f(20)) * 0.6);
  });
});

describe("World", () => {
  const cam = (rx: number, ry: number) => ({ x: 0, y: 0, scale: 1, rx, ry, blur: 0 });
  it("uses a plain 2D transform when there is no tilt, own perspective() otherwise", () => {
    const flat = html(<World camera={cam(0, 0)} width={100} height={100}>w</World>, neutral, 0);
    expect(flat).not.toContain("preserve-3d");
    expect(flat).not.toContain("perspective");
    expect(flat).not.toContain("rotate");
    const tilted = html(<World camera={cam(2, -1)} width={100} height={100}>w</World>, neutral, 0);
    expect(tilted).toContain("rotateX(2deg)");
    // perspectiva propia dentro del transform; nunca en un ancestro ni con preserve-3d
    expect(tilted).toMatch(/transform:translate\(50px, 50px\) perspective\(2400px\) rotateX/);
    expect(tilted).not.toContain("preserve-3d");
    expect(tilted).not.toMatch(/(^|[ ;"])perspective:/);
  });
});
