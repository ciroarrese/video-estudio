import { cornerRadius, entrance, surfaceStyle, textStyle, withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { kf, typed } from "../../kit";
import { fxBox, progress, styleKey, useFx, xform } from "../core";
import type React from "react";
import type { FxProps } from "../core";

export type PaletteItem = { label: string; hint?: string };
export type CommandPaletteProps = FxProps & { query?: string; items?: PaletteItem[] };

const ITEMS: PaletteItem[] = [
  { label: "Nuevo documento", hint: "N" },
  { label: "Nueva carpeta", hint: "⇧ N" },
  { label: "Abrir reciente", hint: "O" },
  { label: "Nuevo proyecto", hint: "P" },
  { label: "Cambiar tema", hint: "T" },
  { label: "Compartir", hint: "S" },
  { label: "Exportar", hint: "E" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Filtra por subcadena sin acentos ni mayusculas; consulta vacia = todos. */
export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = norm(query.trim());
  return q ? items.filter((it) => norm(it.label).includes(q)) : items;
}

/** Paleta de comandos: se abre, se escribe una consulta, los resultados se filtran y uno se "presiona". */
export function CommandPalette(p: CommandPaletteProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const dur = p.duration ?? 85;
  const query = p.query ?? "nue";
  const items = p.items ?? ITEMS;
  const open = Easing.out(progress(local, 0, dur * 0.15));
  const tStart = dur * 0.2, tEnd = dur * 0.55;
  const cps = query.length / (tEnd - tStart);
  const shown = typed(query, local, tStart, cps);
  const doneTyping = local >= tEnd;
  const res = filterItems(items, shown).slice(0, 5);
  const hi = Easing.out(progress(local, dur * 0.6, dur * 0.1));
  const press = kf(local, [dur * 0.78, dur * 0.84, dur * 0.92], [0, 1, 0.0]);
  const pressed = local >= dur * 0.84;
  const fs = theme.type.caption * 0.85;
  const caret = !doneTyping && Math.floor(local / 8) % 2 === 0;
  const rowH = 70;
  // Traslado, escala y opacidad solo mientras la paleta se abre o la fila se presiona (en reposo no queda ninguno).
  // Estilo del diseño: la entrada (baja 24 px y se asienta) la decide `motion.entrance`; el marco, `surfaceStyle`; las esquinas, `shape.corners`.
  const openStyle: React.CSSProperties = { position: "absolute", left: 0, right: 0, top: 20, boxSizing: "border-box", ...entrance(theme, open, 0, { native: "rise", distance: -24 }) };
  const frameStyle: React.CSSProperties = { position: "absolute", inset: 0, boxSizing: "border-box", transform: xform({ scale: 0.95 + 0.05 * open }), ...surfaceStyle(theme, "panel") };
  const radius = cornerRadius(theme, "panel");
  const rowRadius = cornerRadius(theme, "control");
  const keyRadius = Math.min(theme.radius.sm, rowRadius);
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: theme.font.family, ...p.style }}>
      <div key={styleKey(openStyle)} style={openStyle}>
      {/* El marco crece con scale; el contenido (texto) no se escala. */}
      <div key={styleKey(frameStyle)} style={frameStyle} />
      <div style={{ position: "relative", borderRadius: radius, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "0 28px", height: 92, borderBottom: `1px solid ${theme.color.border}` }}>
          <svg width={32} height={32} viewBox="0 0 32 32"><circle cx={14} cy={14} r={9} fill="none" stroke={theme.color.textMuted} strokeWidth={3} /><line x1={21} y1={21} x2={28} y2={28} stroke={theme.color.textMuted} strokeWidth={3} strokeLinecap="round" /></svg>
          <span style={{ fontSize: fs * 1.1, color: shown ? theme.color.text : theme.color.textMuted }}>{shown || "Buscar comandos"}</span>
          <span style={{ width: 3, height: fs * 1.1, background: theme.color.accent, opacity: caret ? 1 : 0, marginLeft: -14 }} />
        </div>
        <div style={{ padding: 14, minHeight: rowH * 3 + 28 }}>
          {res.map((it, i) => {
            const isHi = i === 0 && local >= tEnd;
            const sc = isHi ? 1 - 0.025 * press : 1;
            const bg = isHi ? (pressed ? theme.color.accent : withAlpha(theme.color.accent, 0.14 * hi)) : "transparent";
            const fg = isHi && pressed ? theme.color.onAccent : theme.color.text;
            const rowBg: React.CSSProperties = { position: "absolute", inset: 0, background: bg, borderRadius: rowRadius, transform: xform({ scale: sc }) };
            return (
              <div key={it.label} style={{ position: "relative", height: rowH, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 4, color: fg, fontSize: fs, fontWeight: isHi ? theme.font.weights.semibold : theme.font.weights.regular }}>
                <div key={styleKey(rowBg)} style={rowBg} />
                <span style={{ position: "relative" }}>{it.label}</span>
                {it.hint && <span style={{ position: "relative", fontSize: fs * 0.8, color: isHi && pressed ? theme.color.onAccent : theme.color.textMuted, border: `1px solid ${isHi && pressed ? theme.color.onAccent : theme.color.border}`, borderRadius: keyRadius, padding: "2px 12px", ...textStyle(theme, "eyebrow") }}>{it.hint}</span>}
              </div>
            );
          })}
          {res.length === 0 && <div style={{ padding: 24, fontSize: fs, color: theme.color.textMuted }}>Sin resultados</div>}
        </div>
      </div>
      </div>
    </div>
  );
}
