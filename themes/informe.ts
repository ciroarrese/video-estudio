import type { Theme } from "./types";
import type { TokenReport } from "./fromTokens";
import { checkTheme } from "./contrast";
import { resolveStyle } from "./style";

/** Valor actual de un campo del estilo (`shape.corners`) en el estilo resuelto del tema, como texto. */
function valorDe(theme: Theme, path: string): string {
  let v: unknown = resolveStyle(theme);
  for (const k of path.split(".")) v = (v as Record<string, unknown> | undefined)?.[k];
  return v === null || v === undefined ? "(vacío)" : String(v);
}

/**
 * Líneas del informe del adaptador de tokens que imprime `templates/tema-informe.ts`: roles tomados, roles con el valor del tema base, calculados,
 * ambiguos, avisos y, aparte, el informe de estilo (`report.style`: campos tomados con su token, campos que quedaron con el valor base y los
 * valores inválidos con lo que acepta cada campo). Los campos de estilo con valor base son lo que dice qué le falta al design system.
 */
export function formatTokenReport(theme: Theme, r: TokenReport): string[] {
  const out: string[] = [];
  out.push(`Tomados de los tokens (${Object.keys(r.mapped).length}):`);
  for (const [rol, token] of Object.entries(r.mapped)) out.push(`  ${rol} <- ${token}`);
  out.push("", `Quedaron con el valor del tema base (${r.fallback.length}): ${r.fallback.join(", ") || "ninguno"}`);
  out.push(`Calculados (${r.derived.length}): ${r.derived.join(", ") || "ninguno"}`);
  out.push(`Ambiguos: ${Object.keys(r.ambiguous).length ? JSON.stringify(r.ambiguous) : "ninguno"}`);
  const datos = Object.keys(r.data);
  if (datos.length) out.push(`Colores de datos (${datos.length}): ${datos.map((n) => `${n} <- ${r.data[n]!.source}`).join(", ")}`);
  out.push(`Avisos de los tokens: ${r.warnings.length ? "\n  " + r.warnings.join("\n  ") : "ninguno"}`);
  if (r.notes.length) out.push(`Reconocidos por el tema (${r.notes.length}):\n  ${r.notes.join("\n  ")}`);

  const s = r.style;
  const tomados = Object.entries(s.mapped);
  out.push("", `Estilo (theme.style): ${tomados.length} campos declarados, ${s.fallback.length} con el valor de la base, ${s.invalid.length} inválidos.`);
  if (tomados.length) {
    out.push("Campos de estilo tomados:");
    for (const [campo, origen] of tomados) out.push(`  ${campo} = ${valorDe(theme, campo)} <- ${origen}`);
  }
  if (s.fallback.length) {
    out.push(`Campos de estilo con el valor de la base (${s.fallback.length}): lo que el design system no declaró; revisá cuáles le importan:`);
    out.push("  " + s.fallback.map((c) => `${c}=${valorDe(theme, c)}`).join(", "));
  }
  if (s.invalid.length) {
    out.push(`Campos de estilo inválidos, ignorados (${s.invalid.length}):`);
    for (const i of s.invalid) out.push(`  ${i.path} <- ${i.source}: ${JSON.stringify(i.value)} (acepta: ${i.accepted})`);
  } else out.push("Campos de estilo inválidos: ninguno");

  const estilo = checkTheme(theme).filter((w) => w.pair.startsWith("style."));
  if (estilo.length) {
    out.push(`Avisos del estilo (${estilo.length}):`);
    for (const w of estilo) out.push(`  ${w.severity === "error" ? "ERROR" : w.severity === "note" ? "nota" : "aviso"} ${w.message}`);
  }
  return out;
}
