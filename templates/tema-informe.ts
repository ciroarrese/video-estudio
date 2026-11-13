// Muestra el informe del tema de un video: que roles salieron de los tokens, cuales quedaron con el
// valor del tema base, los avisos y las fallas de contraste.
//   npx tsx templates/tema-informe.ts <slug>             videos/<slug>/theme.ts, o <VE_VIDEOS_DIR>/<slug>/theme.ts si VE_VIDEOS_DIR está definida
//   npx tsx templates/tema-informe.ts /ruta/al/theme.ts  un archivo cualquiera (por ejemplo de una carpeta de afuera)
// Requiere que el theme.ts exporte `report` (de themeFromTokensWithReport) y `theme`.
// El archivo se carga con el mismo vite del proyecto (ssrLoadModule): resuelve el alias `video-estudio/*`, un solo React y los
// imports `?url` de fuentes e imágenes (en el informe llegan como ruta de texto), sin que la carpeta de afuera tenga nada instalado.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { checkTheme } from "../themes";
import type { TokenReport, Theme } from "../themes";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
if (!arg) {
  console.error("Uso: npx tsx templates/tema-informe.ts <slug | ruta/al/theme.ts>");
  process.exit(2);
}
const externa = process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null;
const candidatos = /\.[cm]?tsx?$/.test(arg)
  ? [resolve(arg)]
  : [...(externa ? [join(externa, arg, "theme.ts")] : []), join(repo, "videos", arg, "theme.ts")];
const archivo = candidatos.find((f) => existsSync(f));
if (!archivo) {
  console.error(`No existe el tema de "${arg}". Busqué en:\n  ${candidatos.join("\n  ")}`);
  process.exit(2);
}
// vite.config.ts lee VE_VIDEOS_DIR al cargarse (alias y carpetas permitidas); un archivo suelto no la necesita.
const vite = await createServer({ configFile: join(repo, "vite.config.ts"), logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
let mod: { theme: Theme; report?: TokenReport };
try {
  mod = (await vite.ssrLoadModule(archivo)) as typeof mod;
} finally {
  await vite.close();
}
if (!mod.theme) {
  console.error(`${archivo} no exporta \`theme\`.`);
  process.exit(2);
}

console.log(`Tema "${mod.theme.name}"`);
if (mod.report) {
  const r = mod.report;
  console.log(`\nTomados de los tokens (${Object.keys(r.mapped).length}):`);
  for (const [rol, token] of Object.entries(r.mapped)) console.log(`  ${rol} <- ${token}`);
  console.log(`\nQuedaron con el valor del tema base (${r.fallback.length}): ${r.fallback.join(", ") || "ninguno"}`);
  console.log(`Calculados (${r.derived.length}): ${r.derived.join(", ") || "ninguno"}`);
  console.log(`Ambiguos: ${Object.keys(r.ambiguous).length ? JSON.stringify(r.ambiguous) : "ninguno"}`);
  console.log(`Avisos de los tokens: ${r.warnings.length ? "\n  " + r.warnings.join("\n  ") : "ninguno"}`);
}
const contraste = checkTheme(mod.theme);
console.log(`\nContraste: ${contraste.length ? "" : "sin avisos"}`);
for (const w of contraste) console.log(`  ${w.severity === "error" ? "ERROR" : "aviso"} ${w.message}`);
process.exit(contraste.some((w) => w.severity === "error") ? 1 : 0);
