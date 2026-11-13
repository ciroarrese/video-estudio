# fx/text

Efectos de texto (`MaskedRise`, `KineticWords`, `Typewriter`, `ScrambleDecode`, `SplitFlap`, `DigitRoll`, `MarqueeBands`, `TypeRing`). Galería: `examples/fx-text`.

## Qué toma cada efecto del design system (`theme.style`)

- **Peso e interletrado de titular** (`type.titleWeight`, `type.titleTracking`): `MaskedRise`, `Typewriter` y `ScrambleDecode`, los que usaban `semibold`. Un `weight` explícito gana (y con él no se suma interletrado). Las mediciones (`measureWidth`, `fitText`) aceptan `letterSpacing` (em) en `FontSpec` y lo suman por carácter.
- **Escalonado** (`motion.stagger`): `MaskedRise` (paso entre letras o palabras) y `SplitFlap` (demora entre losetas) escalan su propio paso; con 4 no cambia nada.
- **No siguen el estilo**: `DigitRoll` y `SplitFlap` son cifras de contenido (no rige `numerals`); `KineticWords`, `MarqueeBands`, `TypeRing` y `DigitRoll` usan el peso `stat` a propósito. El punto de `MaskedRise` no depende de `decor.accent`.
- **Llegada, cursor, losetas, alfabeto y adorno** (`style.text.*`, `style.line.glow`, `style.line.dotShape`, `style.depth.fog`; ayudas en `look.tsx`): `arrival` en `MaskedRise` (y `KineticWords`), el extra de `Typewriter` y el sufijo de `DigitRoll`; `caret` en `Typewriter` y `ScrambleDecode`; `tile` en `SplitFlap` y `MarqueeBands`; `charset` en `ScrambleDecode` y `SplitFlap`; `decoration` en `MaskedRise` (prop `decorate={false}` la apaga; `KineticWords` lo hace), `Typewriter`, `ScrambleDecode` y `DigitRoll`; la forma de punto es el separador de `MarqueeBands` y `TypeRing`; `TypeRing` toma además `depth.fog` y `line.glow`. `DigitRoll` toma solo el adorno y la llegada del sufijo: `numerals` no rige en cifras de contenido. Con el estilo por defecto no cambia nada (hojas de `neutral` y `dark` idénticas).
