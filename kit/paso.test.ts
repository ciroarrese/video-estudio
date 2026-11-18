// @vitest-environment node
// `npm run nuevo -- paso <slug> <nombre>` (templates/nuevo.mjs, modo `paso`). La prueba general de `nuevo` vive en render/nuevo.test.ts;
// este caso está acá porque esa prueba pertenece a otro cuadro de trabajo.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { indiceDeEscena, nuevo } from "../templates/nuevo.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporales: string[] = [];
const carpeta = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  temporales.push(d);
  return d;
};
afterAll(() => temporales.forEach((d) => rmSync(d, { recursive: true, force: true })));
const proyecto = () => {
  const d = carpeta("ve-paso-");
  cpSync(join(repo, "templates"), join(d, "templates"), { recursive: true });
  return d;
};
const correr = (args: string[], p: string, env: Record<string, string | undefined> = {}) => {
  const out: string[] = [];
  const err: string[] = [];
  const codigo = nuevo(args, (l) => out.push(l), (l) => err.push(l), { repo: p, env });
  return { codigo, out, err };
};

describe("nuevo paso", () => {
  it("el id de la plantilla de paso pasa a <slug>-<nombre> (y el de escena sigue igual)", () => {
    expect(indiceDeEscena('id: "plantilla-paso",', "abc", "uno")).toBe('id: "abc-uno",');
    expect(indiceDeEscena('id: "plantilla-escena",', "abc", "uno")).toBe('id: "abc-uno",');
  });

  it("crea el paso con el marco, la tabla de tiempos y los imports corregidos", () => {
    const p = proyecto();
    const r = correr(["paso", "tutorial", "crear"], p);
    expect(r.codigo).toBe(0);
    expect(r.out.join("\n")).toContain("videos/tutorial/crear (id de video: tutorial-crear)");
    expect(existsSync(join(p, "videos/tutorial/theme.ts"))).toBe(true);
    const escena = readFileSync(join(p, "videos/tutorial/crear/Scene.tsx"), "utf8");
    expect(escena).toContain("StepFrame");
    expect(escena).toContain("const T = {");
    expect(escena).toContain("SENALES");
    expect(escena).toContain('from "../../../kit"');
    expect(escena).not.toContain('"../../kit"');
    expect(readFileSync(join(p, "videos/tutorial/crear/index.ts"), "utf8")).toContain('id: "tutorial-crear"');
  });

  it("falla si ya existe y valida el nombre", () => {
    const p = proyecto();
    expect(correr(["paso", "t", "uno"], p).codigo).toBe(0);
    expect(correr(["paso", "t", "uno"], p).codigo).toBe(1);
    expect(correr(["paso", "t", "Mal"], p).codigo).toBe(2);
    expect(correr(["paso", "t"], p).err[0]).toMatch(/^Uso: npm run nuevo/);
  });

  it("con VE_VIDEOS_DIR escribe afuera, con imports por alias", () => {
    const p = proyecto();
    const fuera = carpeta("ve-paso-fuera-");
    const r = correr(["paso", "ext", "crear"], p, { VE_VIDEOS_DIR: fuera });
    expect(r.codigo).toBe(0);
    const escena = readFileSync(join(fuera, "ext/crear/Scene.tsx"), "utf8");
    expect(escena).toContain('from "video-estudio/kit"');
    expect(escena).toContain('from "video-estudio/engine"');
    expect(existsSync(join(fuera, "tsconfig.json"))).toBe(true);
  });
});
