import { describe, expect, it } from "vitest";
import * as fx from "./index";
import { dark, editorial, neon, neutral, papel, themeCharacter } from "../themes";

describe("afinidad del catálogo", () => {
  it("cada efecto del catálogo tiene su entrada, y cada entrada es un efecto real", () => {
    for (const name of Object.keys(fx.FX_AFFINITY)) expect(typeof (fx as Record<string, unknown>)[name], name).toBe("function");
    const efectos = Object.keys(fx).filter((k) => /^[A-Z][a-z]/.test(k) && typeof (fx as Record<string, unknown>)[k] === "function" && !["Clip", "SvgShadow", "CountUpSlots", "FrameCanvas"].includes(k));
    const sinEntrada = efectos.filter((k) => !(k in fx.FX_AFFINITY));
    expect(sinEntrada).toEqual([]);
  });
  it("un efecto no encaja y se evita en el mismo carácter", () => {
    for (const [n, v] of Object.entries(fx.FX_AFFINITY)) expect((v.fits as readonly string[]).filter((c) => (v.avoid as readonly string[]).includes(c)), n).toEqual([]);
  });
  it("el carácter de los cinco temas", () => {
    expect([neutral, dark, editorial, neon, papel].map(themeCharacter)).toEqual(["geometrico-sobrio", "tecnico-oscuro", "editorial", "tecnico-oscuro", "ludico-manual"]);
    expect(fx.fxFor(papel).fits).toContain("PaperCollage");
    expect(fx.fxFor(editorial).avoid).toContain("PaperCollage");
  });
});
