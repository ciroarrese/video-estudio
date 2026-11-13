# fx

Catálogo de efectos de animación cortos y reutilizables, sobre `engine/` y `themes/`. Todo sale de `fx/index.ts` (los grupos también se importan por carpeta: `fx/core`, `fx/text`, ...). Catálogo y principios en `docs/animaciones.md`.

## Contrato

Todo efecto cumple las reglas del repo (función pura del cuadro, colores del tema, `random(seed)`, sin CSS animado) y además:

1. **Curvas** (`engine`): `Easing.out` y `Easing.inOut` no cambian. Nuevas: `Easing.back(overshoot = 1.56)` (sobrepaso) y `Easing.lands` = `bezier(0.34, 1.56, 0.64, 1)`. `interpolate` deja pasar valores de easing mayores que 1 (el sobrepaso llega a la salida).
2. **`<FrameCanvas width height draw deps? frame? pixelRatio? style?>`** (`engine`): `draw(ctx, frame, {width, height})` se llama en cada render, con el lienzo limpio y en coordenadas lógicas; la resolución real usa `devicePixelRatio` (o `pixelRatio`). Es la única excepción, junto con `holdRender`, a "sin efectos" (ver `engine/README.md`). `draw` tiene que ser pura. `__ve.checkDeterminism` también compara el contenido de los `<canvas>`.
3. **Ayudas** (`fx/core`): `stagger(i, {each, from?: 'start'|'end'|'center'|number, total?})` -> demora en cuadros; `staggerBy(distancia, porUnidad)`; `progress(frame, start, duracion, easing?)` -> 0..1; `phases(frame, [{at, dur, easing?}])` -> progreso de cada fase; `clip(frame, {start, duration, holdAfter?})` -> `{t, done, active, end}` para escribir la animación sobre un `t` normalizado (y `sub(t, a, b, easing?)` para subtramos); `seededShuffle(n, seed)`; `lerp`, `clamp`, `mix(colorA, colorB, t)`; `<Clip start duration holdAfter?>` monta hijos con cuadro local.
4. **`FxProps`**: `{ frame?, start?, duration?, width?, height?, size?, seed?, style? }` (`fxBox` resuelve el tamaño, `useFx` da `{frame, local, theme}`). Las sobrescrituras de color se tipan con `ColorRole` (nombres de `theme.color`, sin `chart`) y se leen con `roleColor(theme, rol)`; la serie categórica con `chartColor(theme, i)`.
   **Garantía:** el último cuadro de un efecto (`frame >= start + duration`) es una imagen fija compuesta y legible; nada queda a medio camino ni parpadea.

Reglas prácticas: nada de `#hex` ni `font-family` sueltos; texto en DOM para que `qa` lo vea siempre que se pueda. La profundidad se proyecta a mano (traslado y escala, o `FrameCanvas`); el CSS 3D solo se admite como `perspective()` propio de cada elemento, con posiciones de layout enteras y sin `preserve-3d` ni perspectiva en un ancestro (lista única en `docs/reglas.md`). El `scale()` sobre texto se admite si la pieza pasa `--check` completo; ante la duda, animá `font-size` o escalá solo el fondo.

## Galerías

Cada efecto tiene un tramo de 90 cuadros (75 de animación y 15 de pausa) en una de tres galerías:

| Galería | Efectos | Ver | Hoja de cuadros |
|---|---|---|---|
| `examples/fx-text` | los 8 de texto | `/?video=fx-text` | `npm run sheet -- fx-text --count 16` |
| `examples/fx-3d` | los 17 tramos de `fx/three` (`PhoneOrbit` aparece con y sin pantalla) | `/?video=fx-3d` | `npm run sheet -- fx-3d --count 17` |
| `examples/fx-data-ui-art` | datos, interfaz y arte (25 tramos) | `/?video=fx-data-ui-art` | `npm run sheet -- fx-data-ui-art --count 25` |

El tramo `i` ocupa los cuadros `i*90` a `i*90+89`; para ver los cuadros finales (imagen compuesta) conviene `--frames` con `i*90+62`. Todas admiten `&props={"theme":"dark"}`.
