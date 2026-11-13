import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const raiz = path.resolve(__dirname, "..");
// el script exige un slug que empiece con letra o número (no admite "_tmp-test"): se usa uno temporal válido
const slugReal = "tmp-test-nuevo";

// El script escribe en `videos/<slug>` relativo a su propia carpeta de proyecto. En vez de escribir en el `videos/` real (donde
// puede haber videos en construcción que rompan el typecheck, y donde la carpeta temporal se filtraría a otros procesos), la
// prueba arma un proyecto mínimo en una carpeta temporal: copia de `templates/` y enlaces simbólicos a engine, kit, themes,
// stories, fx, qa y node_modules. Los imports relativos de lo generado (`../../../engine`) resuelven contra esos enlaces.
const proyecto = mkdtempSync(path.join(tmpdir(), "ve-nuevo-"));
const carpetaReal = path.join(proyecto, "videos", slugReal);
for (const d of ["engine", "kit", "themes", "stories", "fx", "qa", "audio", "examples", "node_modules", "public"]) {
  if (existsSync(path.join(raiz, d))) symlinkSync(path.join(raiz, d), path.join(proyecto, d), "dir");
}
cpSync(path.join(raiz, "templates"), path.join(proyecto, "templates"), { recursive: true });
// typecheck limitado a lo generado: misma configuración que el proyecto pero solo `videos/` de la copia
writeFileSync(
  path.join(proyecto, "tsconfig.json"),
  JSON.stringify({ extends: path.join(raiz, "tsconfig.json"), include: ["videos/**/*.ts", "videos/**/*.tsx"], exclude: [] }),
);

const limpiar = () => rmSync(carpetaReal, { recursive: true, force: true });
const nuevo = (...args: string[]) => execFileSync("bash", ["templates/nuevo.sh", ...args], { cwd: proyecto, encoding: "utf8" });
const archivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// vive en stories/ porque vitest.config.ts no incluye templates/**
describe("templates/nuevo.sh", () => {
  afterAll(() => rmSync(proyecto, { recursive: true, force: true }));

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
    // typecheck solo de lo generado (y lo que importa): no depende de otros videos de videos/
    try {
      execFileSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: proyecto, stdio: "pipe", env: { ...process.env, PATH: `${path.join(raiz, "node_modules", ".bin")}${path.delimiter}${process.env.PATH}` } });
    } finally {
      limpiar();
    }
  }, 600_000);

  it("el script reescribe también fx y qa en las dos ramas", () => {
    const sh = readFileSync(path.join(raiz, "templates", "nuevo.sh"), "utf8");
    const reglas = sh.split("\n").filter((l) => l.includes("sed -i -E") && l.includes("engine|kit"));
    expect(reglas.length).toBe(2);
    for (const r of reglas) expect(r).toContain("engine|kit|themes|stories|fx|qa");
  });

  it("no deja nada atrás ni toca el videos/ real", () => {
    limpiar();
    expect(existsSync(carpetaReal)).toBe(false);
    expect(existsSync(path.join(raiz, "videos", slugReal))).toBe(false);
  });
});
