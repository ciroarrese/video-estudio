/** Tema de video a 1920x1080, 30 fps. Solo React; sin dependencias del motor. */
export type CubicBezier = [number, number, number, number];

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accent2: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  /** Serie categórica para gráficos. */
  chart: string[];
}

export interface ThemeFontFile {
  weight: number;
  src: string;
}

export interface ThemeFont {
  family: string;
  weights: { regular: number; medium: number; semibold: number; stat: number };
  /** Archivos locales opcionales (para @font-face). */
  files?: ThemeFontFile[];
}

export interface Theme {
  name: string;
  color: ThemeColors;
  gradient: { brand: string };
  font: ThemeFont;
  radius: { sm: number; md: number; panel: number; lg: number; pill: number };
  shadow: { sm: string; md: string; lg: string };
  /** Escala tipográfica en px para video. */
  type: {
    hero: number;
    h1: number;
    h2: number;
    body: number;
    caption: number;
    eyebrow: number;
    stat: number;
    /**
     * Subescala para interfaces recreadas (tablas, fichas, menús) que se leen con la cámara acercada.
     * No es para texto que se lee en pantalla completa: ahí van los escalones de arriba.
     * Si un tema no la declara, `useTheme()` completa los valores de `neutral` (15, 20 y 24 px).
     */
    ui?: TypeUi;
  };
  /** Área segura en px. */
  safe: { x: number; y: number };
  motion: {
    easing: { standard: CubicBezier; out: CubicBezier; inOut: CubicBezier };
    /** Duraciones en cuadros a 30 fps. */
    duration: { fast: number; base: number; slow: number };
  };
  /** Fondo de nubes difuminadas. */
  cloud: ThemeCloud;
  /**
   * Colores con nombre que define el video (estados, severidades, fondos de ficha...) y que no tienen rol en `color`.
   * Se leen con `useTheme().data.<nombre>`; un nombre que no existe lanza un error que lista los declarados.
   * Los nombres son identificadores simples (letras y números, empezando con letra).
   */
  data?: Record<string, string>;
  /** Sobre qué superficies se apoya cada color de `data` y qué contraste mínimo se le pide (lo usa `checkTheme`). */
  dataChecks?: Record<string, DataCheck>;
  /**
   * Pares de contraste de marca que se dan por conocidos, p. ej. `["accent/bg", "data.estado/surface"]`.
   * `checkTheme` los informa como `note` en vez de aviso; el control de calidad (`qa`) sigue juzgando el texto real en pantalla.
   */
  acknowledge?: string[];
}

export type TypeUi = { xs: number; sm: number; md: number };
export type Surface = "bg" | "surface" | "surfaceAlt";

export interface DataCheck {
  /** Superficies sobre las que se dibuja (por defecto `["surface"]`). */
  on: Surface[];
  /** Contraste mínimo: 3 para rellenos y gráficos (por defecto), 4.5 si se usa como texto. */
  min: number;
}

/** Mancha explícita del fondo de nubes. `x` e `y` son fracciones del cuadro (0 a 1), `size` va en px. */
export interface CloudBlob {
  x: number;
  y: number;
  /** Diámetro en px (por defecto 700). */
  size?: number;
  /** Rol del tema (`accent`, `data.estado`...) o color; por defecto, uno de `colors` en orden. */
  color?: string;
}

export interface ThemeCloud {
  /** Colores de las manchas, en orden y en vuelta. */
  colors: string[];
  opacity: number;
  /** Cantidad de manchas del reparto sembrado (por defecto 6). Se ignora si hay `blobs`. */
  count?: number;
  /** Semilla del reparto sembrado (por defecto "clouds"). */
  seed?: string;
  /** Manchas explícitas: reemplazan al reparto sembrado. */
  blobs?: CloudBlob[];
}

/** El tema que devuelve `useTheme()`: con `type.ui` y `data` siempre presentes. */
export type ResolvedTheme = Theme & {
  type: Theme["type"] & { ui: TypeUi };
  data: Record<string, string>;
};
