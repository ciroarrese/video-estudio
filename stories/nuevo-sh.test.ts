import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { reescribirImports } from "../templates/nuevo.mjs";

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
  if (existsSync(path.join(raiz, d))) symlinkSync(path.join(raiz, d), path.join(proyecto, d), "junction") // junction: en Windows no pide permisos de administrador;
}
cpSync(path.join(raiz, "templates"), path.join(proyecto, "templates"), { recursive: true });
// nuevo.mjs lee la configuración local con render/config-local.mjs (JavaScript plano, sin dependencias): hace falta al lado.
mkdirSync(path.join(proyecto, "render"));
cpSync(path.join(raiz, "render", "config-local.mjs"), path.join(proyecto, "render", "config-local.mjs"));
// typecheck limitado a lo generado: misma configuración que el proyecto pero solo `videos/` de la copia
writeFileSync(
  path.join(proyecto, "tsconfig.json"),
  JSON.stringify({ extends: path.join(raiz, "tsconfig.json"), include: ["videos/**/*.ts", "videos/**/*.tsx"], exclude: [] }),
);

const limpiar = () => rmSync(carpetaReal, { recursive: true, force: true });
// node + nuevo.mjs (la única implementación; nuevo.sh solo la llama): no depende de bash ni de sed
const nuevo = (...args: string[]) => execFileSync(process.execPath, ["templates/nuevo.mjs", ...args], { cwd: proyecto, encoding: "utf8" });
const archivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// vive en stories/ porque vitest.config.ts no incluye templates/**
describe("templates/nuevo.mjs", () => {
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
      execFileSync(process.execPath, [path.join(raiz, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "."], { cwd: proyecto, stdio: "pipe" });
    } finally {
      limpiar();
    }
  }, 600_000);

  it("la reescritura de imports cubre engine, kit, themes, stories, fx y qa (y nada más)", () => {
    for (const d of ["engine", "kit", "themes", "stories", "fx", "qa"]) {
      expect(reescribirImports(`from "../../${d}/x"`, "../../../")).toBe(`from "../../../${d}/x"`);
      expect(reescribirImports(`from "../../${d}"`, "video-estudio/")).toBe(`from "video-estudio/${d}"`);
    }
    expect(reescribirImports('from "../../otra"', "video-estudio/")).toBe('from "../../otra"');
  });

  it("no deja nada atrás ni toca el videos/ real", () => {
    limpiar();
    expect(existsSync(carpetaReal)).toBe(false);
    expect(existsSync(path.join(raiz, "videos", slugReal))).toBe(false);
  });
});
