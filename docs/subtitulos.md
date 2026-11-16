# Subtítulos y locución

Un video que va a redes se ve, casi siempre, sin sonido: los subtítulos dejan de ser un adorno y pasan a ser parte del contenido. Esta guía cubre el formato de los datos, el componente `Subtitles` del kit, los archivos `.srt`/`.vtt` aparte y la verificación contra los cortes de escena. El sonido de la locución (mezcla, ducking, sonoridad) está en `docs/audio.md`, sección "Locución".

> Regla de `docs/reglas.md`: sin subtítulos por defecto, porque compiten con la imagen. Se activan cuando la persona dice que el video va a redes, a una pantalla sin sonido, o los pide (cuestionario de la skill, pregunta 6 y 7). Con subtítulos, la imagen sigue explicándose sola: el subtítulo repite lo que se dice, no lo que ya se ve.

## Piezas

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| `Subtitles` | `kit/Subtitles.tsx` | Componente puro del cuadro: dibuja el subtítulo activo, de hasta dos renglones, en el área segura de cada formato. |
| `subtitleBand(theme, { width, height })` | `kit/Subtitles.tsx` | La franja `Rect` donde viven los subtítulos, para dejarla libre en la escena. |
| `leerSubtitulosJson`, `parsearSrt`, `parsearVtt`, `parsearSubtitulos` | `kit/subtitulos.ts` | Lectores (JSON, SRT, VTT; el último detecta por la cabecera `WEBVTT`). |
| `aSrt`, `aVtt`, `aJson` | `kit/subtitulos.ts` | Escritores. |
| `subtitulosDeGuion`, `partirEnFrases`, `cortesDeEscenas` | `kit/subtitulos.ts` | Subtítulos desde el guion (sin locución) y cortes de escena desde las duraciones. |
| `paginarSubtitulo`, `palabrasDe`, `subtituloActivo` | `kit/subtitulos.ts` | Maquetación en renglones sin DOM y tiempos por palabra. |
| `npm run audio -- subtitulos` | `audio/cli.ts` | Convierte, arma desde el guion y escribe `.srt`/`.vtt` junto al mp4. |
| `npm run audio -- locucion` | `audio/cli.ts`, `audio/voz.ts` | Avisos: voz o frases que cruzan un corte de escena, se pisan o se leen muy rápido. |

Todo está exportado desde `kit/index.ts`. `kit/subtitulos.ts` no usa React ni DOM: lo importan también los comandos de `audio/`.

## Formato de datos

Un subtítulo es `{ desde, hasta, texto }`, con `palabras` opcional:

```json
{
  "unidad": "segundos",
  "cues": [
    { "desde": 0.4, "hasta": 3.0, "texto": "Mirá este video sin sonido." },
    { "desde": 3.4, "hasta": 6.9, "texto": "Escribís el texto y ajustás los tiempos.",
      "palabras": [{ "desde": 3.4, "hasta": 3.9, "texto": "Escribís" }, { "desde": 3.9, "hasta": 4.05, "texto": "el" }] }
  ]
}
```

- **Segundos o cuadros.** Una lista a secas es en segundos. `{ "unidad": "cuadros", "fps": 30, "cues": [{ "desde": 12, "hasta": 90, "texto": "..." }] }` va en cuadros (hace falta `fps`, en el archivo o como argumento de `leerSubtitulosJson(entrada, fps)`). Adentro todo es segundos, redondeado al milisegundo, ordenado por `desde`.
- **`palabras`** (opcional) da el tiempo de cada palabra para el estilo karaoke. Sin él, el karaoke las reparte por el largo de cada palabra (`palabrasDe`). En VTT se escriben como etiquetas de tiempo dentro del texto (`Hola <00:00:01.500>mundo`); el lector las entiende y el escritor las genera con `aVtt(cues, { conPalabras: true })` o `--palabras`.
- **Validación.** `desde` no negativo, `hasta` mayor que `desde`, `texto` en cadena; el mensaje nombra el subtítulo (`Subtítulo 3: "hasta" (1) tiene que ser mayor que "desde" (2)`). Los saltos de línea del texto pasan a espacios: los renglones los decide la maquetación, no el archivo.
- **SRT y VTT.** Se leen con CRLF, BOM, números de orden, identificadores, ajustes tras la flecha (`align:start`), bloques `NOTE`/`STYLE`, etiquetas (`<i>`, `<b>`, `{\an8}`) y entidades (`&amp;`). Al escribir, los renglones del archivo se parten por largo (42 caracteres, `--max-car`), balanceados y sin cortar palabras.

En un video, el JSON vive junto a la escena (`videos/<slug>/subtitulos.json`) y se importa: `import pista from "./subtitulos.json"; const CUES = leerSubtitulosJson(pista);`. Así el mismo archivo alimenta el video quemado y los `.srt`/`.vtt`. Ejemplo completo: `examples/subtitulos-demo/`.

## El componente `Subtitles`

```tsx
import { Subtitles, leerSubtitulosJson, subtitleBand } from "../../kit";
const CUES = leerSubtitulosJson(pista);

// en la escena raíz, por encima de los velos de transición (zIndex)
<div style={{ position: "absolute", inset: 0, zIndex: 200, pointerEvents: "none" }}>
  <Subtitles cues={CUES} estilo="karaoke" />
</div>
```

Props: `cues` (segundos), `estilo` (`"bloque"` por defecto o `"karaoke"`), `offsetSec` (corre todo; sirve si el audio arranca después de la apertura), `size` (px; por defecto `theme.type.body`), `bottom` (px al borde de abajo; por defecto el del formato) y `frame` (cuadro a dibujar si no es el del contexto). Va en la escena raíz y no dentro de un `Sequence`: `useFrame()` es local al `Sequence` más cercano, y los tiempos de `cues` son del video entero.

**Estilos.**
- `bloque`: el texto sobre una superficie opaca del tema (`surfaceStyle(theme, "chip")`; con un tema de vidrio se usa `color.surface` para que sea legible sobre cualquier escena). El texto va en `color.text`.
- `karaoke`: lo mismo, pero cada palabra cambia de color al ritmo del habla: la que ya se dijo en `color.text`, la que se dice ahora en el primer acento (`accent`, `accent2`) que llega a 4,5:1 sobre el fondo del bloque (si ninguno, queda en `text`), y la que falta atenuada con `dimmedColor` a un contraste mínimo de 4,5. El peso y el tamaño no cambian, así que el texto no se mueve al avanzar.

**Todo sale del tema.** Tipografía (`font.family`, peso `medium`), colores, esquinas (`cornerRadius`: `chip` para un renglón, `control` para dos), borde y sombra de `surfaceStyle`. Ningún `#hex` (la prueba `kit/Subtitles.test.tsx` lo verifica sobre el código fuente). El texto no usa los roles `caption`/`eyebrow` de `textStyle`: pueden poner mayúsculas, y un subtítulo en mayúsculas se lee peor.

**Posición y área segura, en los tres formatos.** Abajo y al centro, con márgenes laterales `theme.safe.x`:

| Formato | Distancia al borde de abajo | Por qué |
| --- | --- | --- |
| horizontal | `theme.safe.y` | Área segura. |
| cuadrado | `theme.safe.y` + 4 % del alto | Un poco más arriba: en un cuadrado el pie queda más expuesto. |
| vertical | 26 % del alto (499 px en 1080x1920) | Las redes dibujan su interfaz (usuario, descripción, botones) en el último cuarto del cuadro y a la derecha: los subtítulos quedan por encima. |

`subtitleBand(theme, { width, height })` devuelve esa franja como `Rect` (`x`, `y`, `w`, `h`, para dos renglones). **Dejala libre en la escena**: calculá la zona de contenido como el área segura menos la franja (en el ejemplo, `useContenido()`), o usá `placeBeside` con `avoid: [banda]`. El control de calidad (`qa`) juzga los subtítulos como cualquier texto (tamaño, contraste, área segura, superposición con otro texto): no llevan `data-qa-ignore`.

**Renglones: hasta dos, sin cortar con "…".** La maquetación mide con `textWidth` (el mismo medidor que `fitText`; sin DOM):
1. Cada palabra se mide una vez más el espacio. Si todo entra en un renglón, es uno.
2. Si no, se elige el corte de dos renglones que los deja más parejos y que entra en el ancho disponible (área segura menos el relleno del bloque, con 4 % de holgura: la medición y el DOM no coinciden al píxel).
3. Si ni dos renglones alcanzan, el subtítulo se **parte en varias páginas** (nunca se abrevia ni se recorta): cada una con hasta dos renglones. Con la cantidad mínima de páginas, las palabras se reparten lo más parejo posible (así no queda una página de dos palabras al final) y, a igual reparto, se prefiere cortar tras una coma o un punto (hasta 3 páginas; con más se llenan una a una). El tiempo de cada página sale de los tiempos de sus palabras (los de `palabras` o los repartidos por largo), así que en vertical, donde entra menos texto por renglón, un subtítulo largo pasa a dos páginas seguidas (`paginarSubtitulo`).
4. Una palabra más ancha que el renglón queda sola en el suyo (y el contenedor la parte con `overflow-wrap: anywhere` antes que desbordar). Con una fuente más ancha que la medida (`qa --font-fallback wide --font-scale 1.25`), el bloque crece hacia arriba porque está anclado abajo: el texto nunca sale por el pie ni del área segura.

**Entrada y salida acordes al tema.** La entrada es `entrance(theme, p, ...)`, que ya obedece a `theme.style.motion.entrance` (`rise`, `fade`, `slide`, `wipe`, `scale`, `depth`) y a su rebote (`overshoot`), con un recorrido corto (0,4 del tamaño de letra). La duración sigue el carácter del design system (`themeCharacter`, ver `fx/affinity.ts`): `editorial` 9 cuadros (se toma su tiempo), `ludico-manual` 7, `geometrico-sobrio` 6, `tecnico-oscuro` 5 (entra seco), a 30 fps y escalados por `fps`. La salida es un fundido de la mitad de esa duración. **El habla continua no se anima**: si un subtítulo empieza a menos de 0,25 s de donde termina el anterior, cambia de golpe (sin entrada ni salida), porque animar cada frase sobre un habla seguida parece parpadeo. En reposo la pieza no emite `transform` ni `opacity` (regla de residuos de `docs/reglas.md`).

**Determinismo.** Función pura del cuadro y de las props: sin estado, sin azar, sin CSS animado. Probada con `kit/Subtitles.test.tsx` (mismo cuadro, mismo HTML, en cualquier orden) y con `render --check` sobre el ejemplo en los tres formatos.

**Con una historia (`defineStory`).** `defineStory` no tiene una capa superior donde poner los subtítulos. Se arma el video a mano con `composeStory`, que devuelve el componente de la historia, y se le pone `Subtitles` encima:

```tsx
const { component: Story, durationInFrames } = composeStory(spec, scenes);
const Video = () => (
  <ThemeProvider theme={theme}>
    <Story />
    <div style={{ position: "absolute", inset: 0, zIndex: 200, pointerEvents: "none" }}><Subtitles cues={CUES} /></div>
  </ThemeProvider>
);
export default defineVideo({ id: "<slug>", component: Video, fps: 30, width: 1920, height: 1080, durationInFrames, formats: ["vertical", "cuadrado"] });
```

Se pierden las escenas con nombre (`--scene`, `--list-scenes`) y el aviso de largos (`story-fit`) que registra `defineStory`; si hacen falta, se pide una opción de capa superior en `stories/` (no es parte de este kit). Una escena suelta (`defineVideo` con una escena) no tiene el problema.

## Subtítulos desde el guion (sin locución)

Cuando todavía no hay audio, `subtitulosDeGuion` los arma desde el texto de cada escena y su duración:

```ts
subtitulosDeGuion(
  [{ texto: "Presentamos una herramienta. Hace una sola cosa.", frames: 150 }, { texto: ["Se usa en tres pasos."], segundos: 3 }],
  { fps: 30, entradaSec: 0.25, salidaSec: 0.25 },
);
```

Dentro de cada escena se descuentan `entradaSec` y `salidaSec` (0,25 s; nunca más de un cuarto de la escena) y el resto se reparte entre las frases **por su cantidad de palabras**. Las frases salen de la puntuación fuerte (`. ! ? …`); una frase de más de `maxCaracteres` (84: dos renglones de 42) se parte en las comas y, si hace falta, entre palabras. `conPalabras: true` agrega los tiempos por palabra (por largo). Es una pauta: la escena se lee a ritmo parejo, no a ritmo de habla. Sirve para que el video se entienda sin sonido y como borrador de la grabación.

Por la CLI: `npm run audio -- subtitulos --guion videos/<slug>/guion.json --out videos/<slug>/subtitulos.json` (el guion es una lista de escenas o `{ "fps": 30, "escenas": [...] }`).

## Archivos aparte: `.srt` y `.vtt`

Además de los subtítulos quemados, se entregan como archivo (accesibilidad, plataformas que los cargan aparte, traducciones):

```bash
npm run render -- <id> --out out/<id>.mp4
npm run audio -- subtitulos videos/<slug>/subtitulos.json --junto-a out/<id>.mp4      # escribe out/<id>.srt y out/<id>.vtt
npm run audio -- subtitulos videos/<slug>/subtitulos.json --out out/<id>.vtt --palabras  # un solo archivo, con tiempos por palabra
npm run audio -- subtitulos mi-alineacion.srt --out videos/<slug>/subtitulos.json         # SRT/VTT a JSON
```

Es un comando de `audio/cli.ts` y no una bandera de `render`: el render no lee los subtítulos (son parte de la escena), y así no se toca el motor ni la cache de partes. Con varios formatos de pantalla los tiempos son los mismos: un solo `.srt` sirve para los tres.

## Verificar contra los cortes de escena

Con locución (o aunque no haya), `locucion` cruza los tiempos con los cortes de escena:

```bash
npm run audio -- locucion --subtitulos videos/<slug>/subtitulos.json --escenas 100,110,90 --fps 30
npm run audio -- locucion --subtitulos videos/<slug>/subtitulos.json --cortes 3.33,f210 --segundos 10 --estricto
npm run audio -- locucion --subtitulos videos/<slug>/subtitulos.json --escenas 100,110,90 --voz videos/<slug>/audio/locucion.wav --voz-en 0.5
```

`--escenas` (cuadros) o `--escenas-seg` dan la duración de cada escena y los cortes salen de sumarlas; `--cortes` los da a mano (segundos o `f<cuadro>`). Avisos:

| Tipo | Cuándo |
| --- | --- |
| `cruza-corte` | La frase empieza antes y termina después de un corte, y pasa más de `--tolerancia` (0,25 s) de cada lado: partila en el corte o corré el corte. |
| `roza-corte` | Se pasa o arranca un instante respecto del corte (menos de la tolerancia): movela unos cuadros. |
| `solapado` | Dos frases se pisan. |
| `fuera-del-video` | Termina después del final (`--frames` o `--segundos`, o la suma de las escenas). |
| `lectura-rapida` | Más de `--max-cps` (17) caracteres por segundo: se lee mal. Alargala o dividila. |

Con `--voz`, los tramos donde la pista de voz **suena de verdad** (no los de los subtítulos) se cruzan con los mismos cortes, y los avisos llevan el prefijo "Voz:". `--estricto` sale con código 2 si hay algún aviso (para un script de entrega). En código: `verificarVozEscenas(tramos, cortes, opciones)` de `audio/voz.ts`, función pura.

## Flujo en la producción

1. **Cuestionario**: ¿va a redes o se ve sin sonido? Sí: subtítulos por defecto. ¿Habrá locución? Sí: la graba o la aporta la persona (ver "Licencias" en `docs/audio.md`).
2. **Guion**: una columna "texto en pantalla / locución" por escena. Se anota el estilo (`bloque` o `karaoke`) junto con el resto de las decisiones del design system.
3. **Escenas**: la zona de contenido deja libre `subtitleBand(...)` en cada formato; `Subtitles` va en la escena raíz sobre los velos.
4. **Tiempos**: sin locución, `subtitulosDeGuion`. Con locución, a mano o desde un SRT, y `locucion` para verificar.
5. **Controles**: `render --check` (también `--format vertical` y `cuadrado`), `qa` (con `--themes all` y el estrés de tipografía) y la hoja en los tres formatos. Mirá que el subtítulo no tape contenido ni quede pegado al borde, y que el vertical esté por encima de la zona de las redes.
6. **Entrega**: el mp4 con los subtítulos quemados y, además, `subtitulos --junto-a out/<id>.mp4`.

## Límites

- Dos renglones como máximo por página; un texto largo se parte en páginas (no se achica la letra: el tamaño es el del tema).
- La medición usa la fuente del tema. Si la fuente real no carga o el tema no declara archivos de fuente, el ancho puede diferir unos píxeles: por eso la holgura del 4 % y el bloque anclado abajo.
- El karaoke sin `palabras` estima los tiempos por el largo de cada palabra, no por el habla real: para sincronizar de verdad hay que dar los tiempos por palabra (a mano, o con un VTT que traiga etiquetas).
- No hay estilos por hablante, posiciones por cue ni subtítulos arriba: el pie del cuadro es el único lugar. `bottom` mueve la franja entera.
- No genera voz ni transcribe: la alineación la pone la persona.
