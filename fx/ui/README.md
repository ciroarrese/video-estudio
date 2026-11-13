# fx/ui

Efectos de interfaz recreada: notificaciones, chat, paleta de comandos, teléfono, antes/después, baldosas. Mismo contrato que el resto de `fx` (puros del cuadro, tema, imagen final compuesta). Se pueden poner dentro de `World` o en pantalla.

| Pieza | Para qué sirve | Props principales |
|---|---|---|
| `NotificationStack` | Tarjetas que llegan de a una y empujan a las anteriores | `items` (`{title, body?, time?}`) |
| `ChatThread` | Burbujas con indicador de "escribiendo" antes de cada respuesta | `messages` (`{from: "me" \| "them", text}`) |
| `CommandPalette` | Se abre, se escribe una consulta, filtra y "presiona" el primer resultado | `query`, `items` (`{label, hint?}`) |
| `CardFan` | N tarjetas que salen de una pila y se abren en abanico | `items` o `children`, `spread` |
| `PhoneFrame` | Marco de teléfono que recorta sus hijos a la pantalla | `children`, `bezel` |
| `PhoneScroll` | Teléfono con contenido que se desplaza y barra de desplazamiento | `children`, `contentHeight` |
| `BeforeAfter` | Manija que revela el "después" sobre el "antes" (por defecto, alambre → diseño) | `before`, `after`, `rest`, `beforeLabel`, `afterLabel` |
| `TileGrid` | Baldosas que se dan vuelta y se encienden con escalonado sembrado | `cols`, `rows`, `lit`, `seed` |
| `TileDone` | Baldosa que pasa a "hecha" con onda en `start` (acompaña a `Cursor`) | `label`, `pendingText`, `doneText` |

Nota: `PhoneFrame` recorta con `clip-path: inset(0 round r)` (r = 2,2 veces `radius.lg`), no con `border-radius`, para que el radio de pantalla no quede limitado a los radios del tema. Pura geometría exportada: `wipePosition`, `wipeInset`, `filterItems`, `fanPose`, `scrollState`, `stackOffsets`, `chatSchedule`, `tilePlan`.

## Estilo del diseño (`theme.style`)

`NotificationStack`, `ChatThread`, `CommandPalette`, `CardFan`, `BeforeAfter`, `TileGrid` y `TileDone` toman superficie (`surface.kind` y `elevation`), esquinas (`shape.corners`), borde (`shape.border`, `outlined`), entrada (`motion.entrance`, `overshoot`) y paso entre elementos (`motion.stagger`); las etiquetas pequeñas, `type.eyebrow*`. `ChatThread` conserva su "salto" propio solo con `entrance: "auto"`. `PhoneFrame` y `PhoneScroll`: el aparato no sigue `shape.corners`; el contenido de pantalla, sí. Los rótulos llevan `textStyle(theme, "label", { strong: true })` (un escalón sobre `labelWeight`: `semibold` con el estilo por defecto) y el título de la notificación, `textStyle(theme, "title")`.
