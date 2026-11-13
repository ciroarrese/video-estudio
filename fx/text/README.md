# fx/text

Efectos de texto (`MaskedRise`, `KineticWords`, `Typewriter`, `ScrambleDecode`, `SplitFlap`, `DigitRoll`, `MarqueeBands`, `TypeRing`). Galería: `examples/fx-text`.

## Qué toma cada efecto del design system (`theme.style`)

- **Peso e interletrado de titular** (`type.titleWeight`, `type.titleTracking`): `MaskedRise`, `Typewriter` y `ScrambleDecode`, los que usaban `semibold`. Un `weight` explícito gana (y con él no se suma interletrado). Las mediciones (`measureWidth`, `fitText`) aceptan `letterSpacing` (em) en `FontSpec` y lo suman por carácter.
- **Escalonado** (`motion.stagger`): `MaskedRise` (paso entre letras o palabras) y `SplitFlap` (demora entre losetas) escalan su propio paso; con 4 no cambia nada.
- **No siguen el estilo**: `DigitRoll` y `SplitFlap` son cifras de contenido (no rige `numerals`); `KineticWords`, `MarqueeBands`, `TypeRing` y `DigitRoll` usan el peso `stat` a propósito. El punto de `MaskedRise` no depende de `decor.accent`.
