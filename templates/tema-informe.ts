// Muestra el informe del tema de un video: que roles salieron de los tokens, cuales quedaron con el
// valor del tema base, los avisos y las fallas de contraste.
//   npx tsx templates/tema-informe.ts <slug>
// Requiere que videos/<slug>/theme.ts exporte `report` (de themeFromTokensWithReport) y `theme`.
import { checkTheme } from "../themes";
import type { TokenReport, Theme } from "../themes";

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: npx tsx templates/tema-informe.ts <slug>");
  process.exit(2);
}
const mod = (await import(`../videos/${slug}/theme.ts`)) as { theme: Theme; report?: TokenReport };

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
