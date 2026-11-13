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
  };
  /** Área segura en px. */
  safe: { x: number; y: number };
  motion: {
    easing: { standard: CubicBezier; out: CubicBezier; inOut: CubicBezier };
    /** Duraciones en cuadros a 30 fps. */
    duration: { fast: number; base: number; slow: number };
  };
  /** Fondo de nubes difuminadas. */
  cloud: { colors: string[]; opacity: number };
}
