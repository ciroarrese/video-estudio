# fx

Catalogo de efectos de animacion cortos y reutilizables, sobre `engine/` y `themes/`. Todo sale de `fx/index.ts` (los grupos tambien se importan por carpeta: `fx/core`, `fx/text`, ...). Catalogo y principios en `docs/animaciones.md`.

## Contrato

Todo efecto cumple las reglas del repo (funcion pura del cuadro, colores del tema, `random(seed)`, sin CSS animado) y ademas:

1. **Curvas** (`engine`): `Easing.out` y `Easing.inOut` no cambian. Nuevas: `Easing.back(overshoot = 1.56)` (sobrepaso) y `Easing.lands` = `bezier(0.34, 1.56, 0.64, 1)`. `interpolate` deja pasar valores de easing mayores que 1 (el sobrepaso llega a la salida).
2. **`<FrameCanvas width height draw deps? frame? pixelRatio? style?>`** (`engine`): `draw(ctx, frame, {width, height})` se llama en cada render, con el lienzo limpio y en coordenadas logicas; la resolucion real usa `devicePixelRatio` (o `pixelRatio`). Es la unica excepcion, junto con `holdRender`, a "sin efectos" (ver `engine/README.md`). `draw` tiene que ser pura. `__ve.checkDeterminism` tambien compara el contenido de los `<canvas>`.
3. **Ayudas** (`fx/core`): `stagger(i, {each, from?: 'start'|'end'|'center'|number, total?})` -> demora en cuadros; `staggerBy(distancia, porUnidad)`; `progress(frame, start, duracion, easing?)` -> 0..1; `phases(frame, [{at, dur, easing?}])` -> progreso de cada fase; `clip(frame, {start, duration, holdAfter?})` -> `{t, done, active, end}` para escribir la animacion sobre un `t` normalizado (y `sub(t, a, b, easing?)` para subtramos); `seededShuffle(n, seed)`; `lerp`, `clamp`, `mix(colorA, colorB, t)`; `<Clip start duration holdAfter?>` monta hijos con cuadro local.
4. **`FxProps`**: `{ frame?, start?, duration?, width?, height?, size?, seed?, style? }` (`fxBox` resuelve el tamano, `useFx` da `{frame, local, theme}`). Las sobrescrituras de color se tipan con `ColorRole` (nombres de `theme.color`, sin `chart`) y se leen con `roleColor(theme, rol)`; la serie categorica con `chartColor(theme, i)`.
   **Garantia:** el ULTIMO cuadro de un efecto (`frame >= start + duration`) es una imagen fija compuesta y legible; nada queda a medio camino ni parpadea.

Reglas practicas: nada de `#hex` ni `font-family` sueltos; profundidad proyectada a mano (traslado y escala, o `FrameCanvas`), nunca `perspective`/`rotateX` de CSS; texto en DOM para que `qa` lo vea siempre que se pueda.
