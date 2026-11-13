import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const raiz = path.resolve(__dirname, "..");
// el script exige un slug que empiece con letra o número (no admite "_tmp-test"): se usa uno temporal válido
const slugReal = "tmp-test-nuevo";
const carpetaReal = path.join(raiz, "videos", slugReal);

const videosExistia = existsSync(path.join(raiz, "videos"));
const limpiar = () => {
  rmSync(carpetaReal, { recursive: true, force: true });
  // si `videos/` no existía antes de la prueba, tampoco queda
  const v = path.join(raiz, "videos");
  if (!videosExistia && existsSync(v) && readdirSync(v).length === 0) rmSync(v, { recursive: true, force: true });
};
const nuevo = (...args: string[]) => execFileSync("bash", ["templates/nuevo.sh", ...args], { cwd: raiz, encoding: "utf8" });
const archivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// vive en stories/ porque vitest.config.ts no incluye templates/**
describe("templates/nuevo.sh", () => {
  afterAll(limpiar);

  it("reescribe los imports (engine, kit, themes, stories, fx, qa) y la copia pasa el typecheck", () => {
    limpiar();
    nuevo("escena", slugReal, "uno");
    nuevo("historia", slugReal, "uno");
    const fuentes = archivos(carpetaReal).filter((f) => /\.tsx?$/.test(f) && path.dirname(f) !== carpetaReal); // theme.ts (un nivel) lleva "../../"
    expect(fuentes.length).toBeGreaterThan(3);
    for (const f of fuentes) {
      const txt = readFileSync(f, "utf8");
      // ningún import apunta todavía a la ubicación de la plantilla
      expect(txt, f).not.toMatch(/from "\.\.\/\.\.\/(engine|kit|themes|stories|fx|qa)"/);
      expect(txt, f).not.toContain("plantilla-");
    }
    // typecheck de todo el proyecto: tsconfig incluye **/*.ts(x), o sea videos/
    execFileSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: raiz, stdio: "pipe" });
  }, 180_000);

  it("el script reescribe también fx y qa en las dos ramas", () => {
    const sh = readFileSync(path.join(raiz, "templates", "nuevo.sh"), "utf8");
    const reglas = sh.split("\n").filter((l) => l.includes("sed -i -E") && l.includes("engine|kit"));
    expect(reglas.length).toBe(2);
    for (const r of reglas) expect(r).toContain("engine|kit|themes|stories|fx|qa");
  });

  it("no deja nada atrás", () => {
    limpiar();
    expect(existsSync(carpetaReal)).toBe(false);
    if (!videosExistia) expect(existsSync(path.join(raiz, "videos"))).toBe(false);
  });
});
