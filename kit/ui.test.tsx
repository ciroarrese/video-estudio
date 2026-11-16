import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider, neutral, dark, editorial, neon, papel } from "../themes";
import type { Theme } from "../themes";
import { Avatar, Button, Check, Chip, ICON_NAMES, Icon, ListRow } from "./index";

const html = (node: React.ReactNode, theme: Theme = neutral) => renderToStaticMarkup(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
const temas: [string, Theme][] = [["neutral", neutral], ["dark", dark], ["editorial", editorial], ["neon", neon], ["papel", papel]];

describe("kit/ui: piezas de interfaz", () => {
  it("son puras: el mismo marcado cada vez", () => {
    const mk = () => (
      <div>
        <Chip tone="success">Confirmado</Chip>
        <Button pressed={0.5} icon={<Icon name="calendar" />}>Pedir turno</Button>
        <Avatar name="luna" index={2} ring />
        <Check progress={0.5} />
        <ListRow title="Luna" detail="Mañana 10:30" leading={<Avatar name="Luna" />} trailing={<Chip>Pendiente</Chip>} on divider />
      </div>
    );
    expect(html(mk())).toBe(html(mk()));
  });

  it("las esquinas, el borde y la letra salen del design system (cambian entre temas)", () => {
    const sets = new Set(temas.map(([, t]) => html(<Chip on>Hola</Chip>, t)));
    expect(sets.size).toBeGreaterThanOrEqual(4);
    // editorial: esquinas rectas; neutral: píldora
    expect(html(<Chip>x</Chip>, editorial)).toMatch(/border-radius:0(px)?[;"]/);
    expect(html(<Chip>x</Chip>, neutral)).toMatch(new RegExp(`border-radius:${neutral.radius.pill}px`));
    expect(html(<Button>x</Button>, editorial)).toMatch(/border-radius:0(px)?[;"]/);
  });

  it("ningún valor de marca: con un tema centinela solo aparecen sus colores", () => {
    const C = (n: number) => `rgb(${n}, ${n + 1}, ${n + 2})`;
    const t: Theme = {
      ...neutral,
      name: "centinela",
      color: { ...neutral.color, bg: C(1), surface: C(11), surfaceAlt: C(21), text: C(31), textMuted: C(41), border: C(51), accent: C(61), accent2: C(71), onAccent: C(81), success: C(91), warning: C(101), danger: C(111), chart: [C(121), C(131)] },
      radius: { sm: 7001, md: 7002, panel: 7003, lg: 7004, pill: 7005 },
      shadow: { sm: `0 0 0 3001px ${C(161)}`, md: `0 0 0 3002px ${C(171)}`, lg: `0 0 0 3003px ${C(181)}` },
    };
    const out = html(
      <div>
        <Chip tone="danger" on>a</Chip>
        <Chip tone="accent">a</Chip>
        <Button>a</Button>
        <Button variant="secondary">a</Button>
        <Avatar name="x" index={1} ring />
        <Check progress={0.4} />
        <Check filled={false} />
        <Icon name="bell" color="accent" />
        <ListRow title="a" detail="b" on divider />
      </div>,
      t,
    );
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const radii = new Set(Object.values(t.radius).map((r) => `${r}px`));
    for (const m of out.matchAll(/border-radius:([^;"]+)/g)) expect(radii.has(m[1]!.trim()) || m[1]!.trim() === "0", `radio ${m[1]}`).toBe(true);
    // todo color del marcado es uno del tema (el borde del chip encendido lleva el acento con alfa)
    const propios = new Set([...Object.values(t.color).flat(), C(161), C(171), C(181)].map((c) => c.replace(/\s/g, "")));
    for (const m of out.matchAll(/rgba?\(([^)]*)\)/g)) {
      const [r, g, b] = m[1]!.split(",").map((x) => x.trim());
      expect(propios.has(`rgb(${r},${g},${b})`), m[0]).toBe(true);
    }
  });

  it("Icon: los diez íconos existen, siguen el grosor y las puntas del tema, y progress dibuja el trazo", () => {
    expect(ICON_NAMES).toHaveLength(10);
    for (const n of ICON_NAMES) {
      const s = html(<Icon name={n} />);
      expect(s).toContain(`data-ve-icon="${n}"`);
      expect(s).toMatch(/<(path|circle|rect)/);
      expect(s).not.toMatch(/stroke-dash/); // entero: sin propiedades de dibujo
    }
    const fino = { ...neutral, style: { line: { weight: "hairline" as const, cap: "square" as const } } };
    const normal = html(<Icon name="clock" />);
    const t2 = html(<Icon name="clock" />, fino);
    expect(normal).toContain('stroke-linecap="round"');
    expect(t2).toContain('stroke-linecap="square"');
    expect(t2).toContain('stroke-width="0.875"');
    expect(normal).toContain('stroke-width="1.75"');
    expect(html(<Icon name="check" progress={0.25} />)).toMatch(/stroke-dashoffset="0\.75"/);
    expect(html(<Icon name="check" progress={0} />)).not.toMatch(/<path/);
  });

  it("Check: el tilde se dibuja con progress; entero, sin propiedades de dibujo", () => {
    expect(html(<Check progress={0.5} />)).toMatch(/stroke-dashoffset="0\.5"/);
    expect(html(<Check />)).not.toMatch(/stroke-dash/);
    expect(html(<Check progress={0} />)).not.toMatch(/<path/);
  });

  it("Avatar: inicial en mayúscula y color de la serie del tema", () => {
    const s = html(<Avatar name="  lola" index={1} />);
    expect(s).toContain(">L<");
    expect(s).toContain(`background:${neutral.color.chart[1]}`);
  });

  it("ListRow: el título largo no empuja lo de la derecha (minWidth 0) y el separador usa el borde del tema", () => {
    const s = html(<ListRow title="Un nombre bastante largo" trailing={<Chip>x</Chip>} divider />);
    expect(s).toContain("min-width:0");
    expect(s).toContain(`solid ${neutral.color.border}`);
  });

  it("la letra de los títulos y de las piezas respeta font.display solo donde corresponde (no en las piezas de interfaz)", () => {
    const t: Theme = { ...neutral, font: { ...neutral.font, display: "Titulos, serif" } };
    expect(html(<ListRow title="a" />, t)).not.toContain("Titulos");
  });
});
