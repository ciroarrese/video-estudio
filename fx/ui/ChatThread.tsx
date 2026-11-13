import type React from "react";
import { Easing } from "../../engine";
import { fade, fxBox, progress, styleKey, useFx, xform } from "../core";
import type { FxProps } from "../core";

export type ChatMessage = { from: "me" | "them"; text: string };
export type ChatThreadProps = FxProps & { messages?: ChatMessage[] };

const DEFAULT: ChatMessage[] = [
  { from: "them", text: "¿Ya tenés el borrador del informe?" },
  { from: "me", text: "Sí, te lo mando en un rato." },
  { from: "them", text: "Genial. ¿Incluye los números del trimestre?" },
  { from: "me", text: "Incluye todo, con un gráfico nuevo." },
  { from: "them", text: "Perfecto, lo reviso hoy." },
];

/** Cuadro en que aparece cada burbuja y cuadro en que empieza a escribir (solo respuestas "them"), en tiempo local. */
export function chatSchedule(messages: ChatMessage[], duration: number): { typingAt: number | null; popAt: number }[] {
  const n = messages.length;
  const slot = (duration - 14) / n;
  return messages.map((m, i) => {
    const t0 = i * slot;
    return m.from === "them" ? { typingAt: t0, popAt: t0 + slot * 0.45 } : { typingAt: null, popAt: t0 + slot * 0.1 };
  });
}

/** Burbujas de chat que aparecen una a una, con indicador de "escribiendo" antes de cada respuesta. */
export function ChatThread(p: ChatThreadProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 760, height: 560 });
  const messages = p.messages ?? DEFAULT;
  const dur = p.duration ?? 80;
  const sched = chatSchedule(messages, dur);
  const fs = theme.type.caption * 0.85;
  // El "pop" escala solo el fondo de la burbuja; el texto no se escala (se desvanece), así el trazado de las letras no depende del historial.
  // Opacidad y escala solo mientras la burbuja aparece: en reposo no queda `scale(1)` ni `opacity: 0.99`.
  const bubble = (key: string, mine: boolean, scale: number, children: React.ReactNode) => {
    const outer: React.CSSProperties = { position: "relative", alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "76%", boxSizing: "border-box", padding: "16px 24px", color: mine ? theme.color.onAccent : theme.color.text, fontSize: fs, lineHeight: 1.3, opacity: fade(Math.min(1, scale * 1.4)) };
    const tf = xform({ scale });
    const back: React.CSSProperties = { position: "absolute", inset: 0, background: mine ? theme.color.accent : theme.color.surfaceAlt, border: mine ? "none" : `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxSizing: "border-box", transform: tf, transformOrigin: tf ? (mine ? "100% 100%" : "0% 100%") : undefined };
    const txt: React.CSSProperties = { position: "relative", opacity: fade(Math.min(1, Math.max(0, (scale - 0.55) / 0.45))) };
    return (
      <div key={`${key}:${styleKey(outer)}`} style={outer}>
        <div key={styleKey(back)} style={back} />
        <div key={styleKey(txt)} style={txt}>{children}</div>
      </div>
    );
  };
  const out: React.ReactNode[] = [];
  messages.forEach((m, i) => {
    const s = sched[i]!;
    const mine = m.from === "me";
    const pop = Easing.lands(progress(local, s.popAt, 12));
    const typing = s.typingAt !== null && local >= s.typingAt && local < s.popAt;
    if (typing) {
      out.push(bubble(`t${i}`, false, Easing.out(progress(local, s.typingAt!, 6)), (
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center", height: fs * 0.9 }}>
          {[0, 1, 2].map((d) => <span key={d} style={{ width: 12, height: 12, borderRadius: theme.radius.pill, background: theme.color.textMuted, transform: xform({ y: Math.sin(local * 0.55 - d * 0.9) * -5, round: true }), display: "inline-block" }} />)}
        </span>
      )));
    }
    if (local >= s.popAt) out.push(bubble(`m${i}`, mine, pop, m.text));
  });
  return (
    <div style={{ width: w, height: h, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16, fontFamily: theme.font.family, ...p.style }}>{out}</div>
  );
}
