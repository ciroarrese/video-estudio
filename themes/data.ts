import type { ResolvedTheme, Theme, TypeDisplay, TypeUi } from "./types";
import { isValidColor } from "./color";

/** Escalones de `type.ui` cuando el tema no los declara. */
export const DEFAULT_TYPE_UI: TypeUi = { xs: 15, sm: 20, md: 24 };
/** Escalones de `type.display` cuando el tema no los declara. */
export const DEFAULT_TYPE_DISPLAY: TypeDisplay = { sm: 48, md: 56, lg: 64 };

/** Nombre válido de un color de datos: se lee con `theme.data.nombre`. */
export const DATA_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

/** Claves que herramientas (JSON, comparadores, React) consultan sin querer: nunca son un color de datos faltante. */
const SONDEOS = new Set(["then", "toJSON", "asymmetricMatch", "nodeType", "tagName", "length", "size"]);

const estrictos = new WeakSet<object>();

/** `true` si `data` ya es el objeto estricto que lanza ante un nombre inexistente. */
export function isStrictData(data: unknown): boolean {
  return typeof data === "object" && data !== null && estrictos.has(data);
}

/**
 * Objeto de colores de datos que lanza un error claro si se lee un nombre que no existe
 * (un `undefined` silencioso terminaría como un color en blanco en pantalla). Lo demás se comporta como un objeto común.
 */
export function strictData(map: Record<string, string>, themeName = "tema"): Record<string, string> {
  const target: Record<string, string> = { ...map };
  const p = new Proxy(target, {
    get(t, key, receiver) {
      if (typeof key === "string" && DATA_NAME.test(key) && !SONDEOS.has(key) && !Reflect.has(t, key)) {
        const names = Object.keys(t);
        throw new Error(
          `Tema "${themeName}": no hay un color de datos "${key}". ` +
            (names.length ? `Declarados: ${names.join(", ")}. ` : "No hay ninguno declarado. ") +
            "Se declaran en theme.data o con themeFromTokens(tokens, base, { data: { nombre: token } }).",
        );
      }
      return Reflect.get(t, key, receiver);
    },
  });
  estrictos.add(p);
  return p;
}

const cache = new WeakMap<object, ResolvedTheme>();

/**
 * Completa lo opcional del tema: `type.ui` y `type.display` (con los valores de `neutral`) y `data` estricto.
 * Devuelve el mismo objeto si ya está completo; si no, una copia superficial guardada en caché por tema.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  const hit = cache.get(theme);
  if (hit) return hit;
  const needsUi = !theme.type.ui;
  const needsDisplay = !theme.type.display;
  const needsData = !isStrictData(theme.data);
  if (!needsUi && !needsDisplay && !needsData) return theme as ResolvedTheme;
  const out: ResolvedTheme = {
    ...theme,
    type: { ...theme.type, ui: theme.type.ui ?? DEFAULT_TYPE_UI, display: theme.type.display ?? DEFAULT_TYPE_DISPLAY },
    data: needsData ? strictData(theme.data ?? {}, theme.name) : (theme.data as Record<string, string>),
  };
  cache.set(theme, out);
  return out;
}

/**
 * Resuelve una referencia de color del tema: un rol de `color` (`"accent"`, `"bg"`), un elemento de la serie (`"chart[2]"`),
 * un color de datos (`"data.estado"`) o un color válido (hex, rgb, hsl) ya sacado del tema. Si no es ninguno, lanza un error que lista los roles.
 */
export function resolveColor(theme: Theme, ref: string): string {
  const c = theme.color as unknown as Record<string, unknown>;
  const v = c[ref];
  if (typeof v === "string") return v;
  const m = /^chart\[(\d+)\]$/.exec(ref);
  if (m) {
    const col = theme.color.chart[Number(m[1])];
    if (col) return col;
  }
  if (ref.startsWith("data.")) return resolveTheme(theme).data[ref.slice(5)]!;
  if (isValidColor(ref)) return ref;
  const roles = Object.keys(c).filter((k) => typeof c[k] === "string");
  throw new Error(
    `Color "${ref}": no es un rol del tema ni un color válido. Roles: ${roles.join(", ")}, chart[n], data.<nombre>.`,
  );
}
