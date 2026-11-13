# Origen del motor

Este motor (`engine/`) se escribió desde cero para este repositorio.

- No se leyó ni se copió código fuente de Remotion ni de otros frameworks de video.
- Los nombres de la API (`useFrame`, `interpolate`, `Sequence`, `Series`, `Easing`, etc.) siguen el vocabulario común de animación; el diseño parte de la idea general de que un video es una función del número de cuadro.
- Algoritmos de terceros usados, reimplementados a partir de su descripción matemática o pública:
  - Curva cúbica de Bézier (`Easing.bezier`): formulación estándar de Bézier unitaria (como en CSS `cubic-bezier`), resuelta con Newton y bisección de respaldo. Es matemática estándar, sin código de terceros.
  - Azar determinista (`random`): hash de cadenas tipo xmur3 + generador mulberry32. Ambos son de dominio público.
- No se incluyen dependencias de otros motores de video. Dependencias de ejecución: React y React DOM (licencia MIT).
- Las dependencias de desarrollo (Vite, Vitest, TypeScript, jsdom, Testing Library) se usan como herramientas y no se redistribuyen.

## Catálogo de efectos (`fx/`)

El catálogo de efectos (`fx/`) se inspira en listas de estudios de movimiento cortos que se comparten públicamente. Todo el código y todas las descripciones de este repositorio son originales: no se incluyen prompts de terceros, paletas de color ni tipografías ajenas; los colores y las fuentes salen siempre del tema.
