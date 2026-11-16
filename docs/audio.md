# Audio

Herramientas de línea de comandos para ponerle sonido a un video: detectar el tempo de una pista, empalmarla al compás para que dure lo mismo que el video, sintetizar efectos propios y mezclarlo todo en un solo archivo. Viven en `audio/` y usan ffmpeg (tiene que estar en el PATH) y TypeScript con `tsx`; no agregan dependencias de npm.

```bash
npm run audio -- <comando> ...         # es `tsx audio/cli.ts`; en todo el repo se usa esta forma
```

## Cuándo usar cada una

| Herramienta | Usala cuando | Entrega |
| --- | --- | --- |
| `tempo` | Tenés una pista y necesitás saber dónde caen los pulsos y dónde entra la percusión o cambia la sección. | JSON con BPM, confianza, confianza de la fase, pulsos en segundos y en cuadros, inicio de la percusión y `secciones`. |
| `empalme` | La pista no dura lo que el video, o querés arrancar justo en la percusión. | Un archivo de audio de la duración exacta, con inicio y empalmes sobre pulsos (dentro del cuerpo de la pista, sin su intro baja ni su caída final), y los cuadros de cada pulso. |
| `efectos` | Necesitás sonidos cortos (golpe, clic, barrido, campanita, tilde, aviso), o probar otro clic u otra transición. | WAV sintetizados, originales, en la carpeta que elijas (con variantes `clic-<nombre>` y `barrido-<nombre>`). |
| `mezcla` | Tenés una lista de momentos (cues) y, opcionalmente, música y una locución que grabaste o aportás. | Un solo archivo de audio listo para usar como pista del video. |
| `subtitulos` | Querés los subtítulos como archivo aparte (`.srt` y `.vtt` junto al mp4), convertir entre formatos o armarlos desde el guion. | Archivos de subtítulos (ver `docs/subtitulos.md`). |
| `locucion` | Tenés subtítulos (o una pista de voz) y querés saber si algo se pisa con el corte de escenas o se lee demasiado rápido. | Avisos con el instante y la frase. |
| `audio/beats.ts` | Querés que una animación caiga sobre el compás. | Funciones puras: `beatAt`, `beatPhase`, `nearestBeat`, `pulse`, `framesPerBeat`. |

## Flujo para un video

1. **Elegir el tema con licencia verificada.** Que permita usarlo donde se va a mostrar el video y redistribuirlo. Anotá de dónde salió y bajo qué licencia. Nunca se sube música al repo.
2. **`tempo`**: `npm run audio -- tempo tema.wav --fps 30 --out videos/<slug>/tempo.json`. Mirá `bpm`, `confidence` y `phaseConfidence`; si alguna es baja, revisá el apartado de límites. Si la pista es un mp3, convertila antes a wav (ver "mp3 sin etiqueta").
3. **`empalme`**: `npm run audio -- empalme tema.wav --frames 900 --fps 30 --inicio percusion --tempo videos/<slug>/tempo.json --out videos/<slug>/audio/musica.wav --json videos/<slug>/audio/musica.json`. Arranca sobre el pulso donde entra la percusión, repite compases enteros si la pista es corta (cruce de potencia constante de 40 ms en cada empalme), entra con un fade de 0,3 s y cierra con una caída de 2 s (o con el final propio de la pista, ver `--final real`). Imprime `beatFrames` y `spliceFrames`. Con `--corte-en` podés pedir que un empalme caiga cerca de un cambio de escena.
4. **`efectos`**: `npm run audio -- efectos --out videos/<slug>/audio/sfx` (el valor por defecto es `public/sfx/`, ignorado por git, pero acá usamos la carpeta del video). Ver `--lista` para los nombres.
5. **`mezcla`**: con un `cues.json` como `[{"frame": 45, "sfx": "clic"}, {"frame": 120, "sfx": "tilde", "gain": 0.7}]`:
   `npm run audio -- mezcla --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx --fps 30 --frames 900 --musica videos/<slug>/audio/musica.wav --musica-gain 0.5 --lufs -16 --out videos/<slug>/audio/audio-<slug>.wav`.
   La mezcla puede contener música con licencia: va a `videos/<slug>/audio/`, que está ignorada por git (`videos/` en `.gitignore`), y nunca a `public/`.
6. **Usar el archivo en el video**: `<Audio src={asset("audio-<slug>.wav")} />` en la escena raíz (o `defineStory({ audio: { src: "audio-<slug>.wav" } })`). `videos/<slug>/audio` (y `<VE_VIDEOS_DIR>/<slug>/audio`) se sirve sola en `render`, `qa`, `sheet`, `privacy` y `npm run dev`, sin `--assets` (ver `render/README.md`, "Archivos del video"); `--assets <dir>` queda para otra carpeta. Así el archivo no pasa por `public/`. La vista previa de desarrollo no reproduce `<Audio>` (el componente no dibuja nada; el sonido lo mezcla el renderizador), así que no hace falta copiar nada a `public/`. Además, usá los `beatFrames` de `audio/musica.json` para sincronizar animaciones:

```tsx
import { pulse, nearestBeat } from '../../audio/beats';
const beats = musica.beatFrames;            // del JSON de empalme: ya están en tiempo de salida
const frame = useFrame();
const escala = 1 + 0.06 * pulse(frame, beats, 0.25);
```

7. **Renderizar y revisar el sonido**: `npm run render -- <id>` mezcla el audio sobre el video y mide el pico del AAC (ver "Sonoridad y pico"); `--audio-peak-strict` en el comando final de una entrega. Si solo cambiás el audio (otro techo, otra música), volvé a correr el mismo comando: el video sale de la cache y tarda segundos. Para escuchar solo un tramo con su sonido: `npm run render -- <id> --seconds 1:30-2:05` (o `--frames a-b`).

**Una sola carpeta de salida.** Todo lo que genera `empalme` (la pista y su JSON) y `mezcla` (el WAV final) va a `videos/<slug>/audio/`, junto con `sfx/`; `tempo.json` y `cues.json` quedan en `videos/<slug>/`. Así `--assets videos/<slug>/audio` encuentra los archivos y nada pasa por `public/`.

Si usás `empalme` y `mezcla` juntos, los cuadros de los cues se miden en el tiempo del video, igual que `beatFrames` de la salida de `empalme`. `beatFrames` son números fraccionarios (un pulso rara vez cae justo en un cuadro); las funciones de `beats.ts` los aceptan tal cual.

## Sin música: plan de cues

Con solo efectos el sonido queda flaco si cada uno suena aislado. Un plan que alcanza para un video corto (30 a 60 s):

- **Una acción clave, un sonido**: `clic` en el cuadro de cada clic del cursor, `tilde` cuando algo queda hecho o aprobado, `aviso` cuando aparece un resultado o una alerta, `campanita` para un logro (una vez, no más).
- **Una transición, un `barrido`**: en el primer cuadro del atravesado (`zoomThrough`) o del velo (`Wash`) de cada escena.
- **Un `golpe` suave** (`"gain": 0.5` a `0.7`) en el título de la apertura y otro en el cierre.
- Dejá aire: unos 8 a 10 cuadros entre efectos, salvo un redoble pensado, y bajá el `gain` (0,6 a 0,8) de los que se repiten.

Locución: la herramienta no genera voz; si la persona la aporta, entra como capa de la mezcla y baja la música sola (ver "Locución").

Música: es opcional y la decide la persona; la pista y su licencia las trae ella (ver "Licencias"). Con música, los efectos bajan la música solos 5 dB mientras suenan (ver "Ducking").

## Comandos y opciones

Todas las opciones numéricas se validan: un valor que no es número, una bandera sin valor (`--inicio` a secas) o un valor fuera de rango (`--fps 0`, `--compas 2.5`) cortan con un error claro antes de procesar nada. Las rutas se resuelven a absolutas, así que un archivo que empiece con `-` no se confunde con una opción de ffmpeg.

- `tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--fase medio] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]`. Entrega `bpm`, `confidence`, `phaseConfidence`, `beatsSec`, `beatFrames`, `percussionStart`, `percussionBeat` y `secciones` (ver "Fase, percusión y secciones").
- `empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S) [--inicio percusion|seccion:<n>|<seg>] [--tempo tempo.json | --bpm N --offset seg [--fase medio]] [--lazo-inicio seg] [--lazo-fin seg] [--corte-en seg|f<cuadro>[,...]] [--final fade|real] [--compas 4] [--cruce 0.04] [--fade 2] [--fade-in 0.3] [--sin-cuerpo] [--sr 48000] [--json plan.json]`. El formato de salida lo da la extensión (`.wav`, `.mp3`, `.m4a`); el wav sale en 24 bits. Sin `--tempo` ni `--bpm` analiza la pista él mismo. Si la pista alcanza para la duración, solo recorta (sin empalmes). `--inicio` se ajusta al pulso más cercano. Detalle en "Empalme: el cuerpo de la pista".
- `efectos [--out public/sfx] [--lista] [--clic <nombre>] [--barrido <nombre>]`. Genera `golpe`, `clic`, `barrido`, `campanita`, `tilde` y `aviso` (WAV mono de 16 bits, 48 kHz) y, además, una variante `clic-<nombre>` por cada clic alternativo (ver "Variantes del clic"). `--clic <nombre>` elige cuál variante se escribe como `clic` a secas (por defecto `actual`). `--barrido <nombre>` hace lo mismo con el `barrido` (ver "Variantes del barrido"); también se escribe un `barrido-<nombre>` por variante. `--lista` nombra los efectos con el instante de su pico y describe las variantes del clic y del barrido.
- `mezcla --cues cues.json --fps F --frames N --out audio.wav [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg] [--fade-in seg] [--fade-out 1] [--duck-db 5] [--duck-ataque 10] [--duck-release 250] [--duck-escala-gain] [--lufs <objetivo>] [--techo -1] [--gain nombre=número[,...]] [--sr 48000]`. En un cue, `sfx` es un nombre del set (se busca `<--sfx>/<nombre>.wav`) o una ruta a cualquier archivo; `gain` es un multiplicador lineal (1 por defecto); `ancla` es `"inicio"` (por defecto) o `"pico"`. Un cue fuera del video se omite con un aviso; un efecto que no existe corta antes de procesar nada, nombrando el cue. `--gain barrido=0.4,tilde=0.8` multiplica el `gain` de todos los cues de cada efecto nombrado, para bajar (o subir) toda una clase sin tocar la lista de cues; el nombre se compara con el `sfx` del cue tal cual (`barrido-aire` no cuenta como `barrido`; una ruta a un archivo cuenta por su nombre sin extensión, así `clic` alcanza a `/ruta/clic.wav`), el valor es un número de 0 en adelante, y un nombre que no coincide con ningún cue avisa. El `gain` resultante también cuenta para el ducking: un cue que queda por debajo de 0,1 deja de bajar la música. La salida tiene exactamente la duración del video y un limitador de pico verdadero. `--duck N` (la vieja razón de compresión) se sigue aceptando: `--duck 0` apaga el ducking y cualquier otro valor se ignora con un aviso. Con locución, `--voz archivo [--voz-gain 1] [--voz-desde seg] [--voz-en seg] [--voz-duck-db 8] [--voz-ataque 60] [--voz-release 450] [--voz-umbral dBFS] [--voz-une 350]` (ver "Locución"); con `--voz` o `--musica`, `--cues` es opcional.
- `subtitulos <entrada.json|.srt|.vtt> | --guion guion.json [--fps 30] [--out salida.srt|.vtt|.json] [--junto-a out/video.mp4] [--palabras] [--max-car 42] [--max-subtitulo 84]` y `locucion --subtitulos <archivo> (--cortes 5,f300 | --escenas 150,120 | --escenas-seg 5,4) [--fps 30] [--frames N | --segundos S] [--tolerancia 0.25] [--max-cps 17] [--voz archivo ...] [--estricto]`: están explicados en `docs/subtitulos.md`.

## Variantes del clic

`efectos` escribe siempre `clic.wav` y, junto a él, un `clic-<nombre>.wav` por cada variante. Un cue elige la que quiere con `"sfx": "clic-<nombre>"`; para cambiar el `clic` de todo un video sin tocar los cues, generá los efectos con `--clic <nombre>`:

```bash
npm run audio -- efectos --out videos/<slug>/audio/sfx --clic thock    # clic.wav es ahora el "thock"
```

Todas son mono, duran entre 35 y 110 ms (salvo las de mouse, que van más abajo), tienen el pico cerca de -3 dBFS (`actual`, -2 dBFS), empiezan y terminan en cero y no tienen continua. `efectos --lista` las describe.

| Nombre | Cómo suena | Cuándo va bien |
| --- | --- | --- |
| `actual` | Chasquido agudo y seco sobre un cuerpo resonante corto (el original). | Referencia; el que más se oye entre percusión. |
| `suave` | Golpecito de graves y medios, casi sin agudos ni resonancia. | Interfaces calmas y música tranquila; no cansa si se repite. |
| `mecanico` | Interruptor: golpe de bajada y, 55 ms después, uno chico de subida. | Botones y llaves con peso; sensación de objeto físico. |
| `madera` | Toc afinado cerca de 1 kHz, que se apaga rápido. | Interfaces cálidas, artesanales o didácticas. |
| `cristal` | Tic brillante con una resonancia fina que queda un instante. | Interfaces limpias y modernas; es el más agudo, mejor con música mullida. |
| `burbuja` | Soplido redondo con el tono bajando de unos 900 a 350 Hz. | Interfaces amables o lúdicas; abrir, seleccionar, tildar. |
| `digital` | Blip de triángulo cerca de 1 kHz, filtrado, sin filo. | Software y música lo-fi: electrónico pero amable. |
| `thock` | Tecla amortiguada: cuerpo cerca de 180 Hz y un hueco a 420 Hz. | Escritura, listas y formularios; el más cálido. |
| `cinta` | Ráfaga acotada en banda y un poco saturada, sin extremos. | Música lo-fi cálida: se mezcla con el grano en lugar de destacar. |

### Clic de mouse

Un clic de mouse real no es un aviso de interfaz: son **dos golpes** (la bajada y la subida del botón, a unos 70 a 130 ms), cada uno un chasquido de banda ancha de pocos milisegundos seguido del repiqueteo seco de la carcasa de plástico, sin tono y casi sin graves. Las variantes `mouse*` lo sintetizan con un modelo físico chico (`audio/mouse.ts`): una ráfaga de ruido con semilla excita un banco de resonadores amortiguados (los modos inarmónicos de la carcasa, de 1,5 a 7 kHz, que se apagan en 5 a 20 ms) y se le suma un tic de banda ancha. La subida sale más baja de nivel y más aguda que la bajada, y cada evento lleva pequeñas irregularidades de nivel, de tiempo y de frecuencia. Son deterministas, mono, con el pico cerca de -3 dBFS, empiezan y terminan en cero y no tienen continua.

| Nombre | Qué es | Cuándo va |
| --- | --- | --- |
| `mouse` | Mouse de oficina común: bajada y subida a unos 95 ms. | El clic del cursor en una demo de software; la opción por defecto para "esto es un clic de mouse". |
| `mouse-suave` | Mouse de interruptor silencioso: más sordo, menos agudos, ataque blando. | Música tranquila o muchos clics seguidos. |
| `mouse-marcado` | Microinterruptor mecánico: más agudo y seco, con la subida tan fuerte como la bajada. | Música con percusión (es de los que mejor se abren paso) o un mouse "gamer". |
| `mouse-apretar` | Solo la bajada. | Clics rápidos del cursor o en ráfaga, donde la subida embarra. |
| `mouse-doble` | Dos clics completos, a unos 200 ms entre bajadas. | Abrir un archivo o una carpeta, seleccionar una palabra. |

```bash
npm run audio -- efectos --out videos/<slug>/audio/sfx --clic mouse    # clic.wav pasa a ser el clic de mouse
```

Un cue lo pide por su nombre de archivo: `{"frame": 120, "sfx": "clic-mouse"}` (o `clic-mouse-doble`, etc.). Ojo con el nivel: son transitorios de pocos milisegundos y por energía casi no suman a una música a 0,6 de ganancia, aunque se oyen bien por encima de 2 kHz; con música con percusión, `mouse-marcado` o un `gain` de 1,3 a 1,6 en el cue, y evitá que caiga sobre el bombo (el contratiempo, el "y" del pulso, queda libre).

Si preferís un sonido grabado de un mouse de verdad, no hace falta tocar el repo: apuntá el `sfx` del cue a un archivo (`{"frame": 120, "sfx": "/ruta/a/mi-clic.wav"}`). Verificá antes que su licencia permita usarlo donde se va a mostrar el video y redistribuirlo (ver "Licencias"); el archivo queda en la carpeta del video, nunca en el repo.

Con música, un clic suave puede quedar tapado si cae justo sobre el bombo; subile el `gain` del cue (1,2 a 1,5 con ducking) o corré el cue unas décimas de pulso. El set y la forma de medir las diferencias están en `audio/efectos.ts` (`CLICS`) y `audio/efectos.test.ts`.

## Variantes del barrido

El `barrido` actual (0,7 s, sube de 180 Hz a 2,5 kHz, pico en -3 dBFS) marca el movimiento con claridad; en un video con muchas transiciones llega a ser lo más fuerte de la mezcla y se repite hasta cansar. `efectos` escribe `barrido.wav` y, junto a él, un `barrido-<nombre>.wav` por variante. Un cue elige la que quiere con `"sfx": "barrido-<nombre>"`; para cambiar el `barrido` de todo un video sin tocar los cues, generá los efectos con `--barrido <nombre>`:

```bash
npm run audio -- efectos --out videos/<slug>/audio/sfx --barrido suave    # barrido.wav es ahora el "suave"
```

Las cuatro nuevas están hechas para ir **más abajo** que el resto de los efectos: pico en -6 dBFS (el `barrido` actual y los demás, entre -3 y -2), mono, deterministas, con los extremos en cero, sin continua y casi sin energía arriba de 5 kHz (menos de 1 % en `aire`, `suave` y `grave`; menos de 2 % en `papel`). Se escriben a ese nivel y el `gain` del cue se suma encima: la columna "Gain" es el punto de partida recomendado con música a 0,5 de ganancia (`--musica-gain 0.5`); escuchá y ajustá.

| Nombre | Cómo suena | Cuándo va bien | Gain |
| --- | --- | --- | --- |
| `actual` | El de siempre: aire ascendente, 0,7 s, pico a la mitad. | Referencia. | 1 |
| `aire` | Soplo de aire de unos 300 ms entre 400 Hz y 3 kHz, con la banda moviéndose apenas; entra despacio (sin transitorio) y se apaga sin cola. | Acompañar cada movimiento de cámara o de panel sin marcarlo: se siente más de lo que se oye. Es el que aguanta repetirse. | 0,3 |
| `suave` | El "whoosh" clásico, redondo: pasabajos (sin brillo), 0,45 s, sube de 150 a 900 Hz con subida y bajada suaves. | Transiciones entre escenas o cambios de tema, en lugar del actual: se reconoce como un barrido sin el filo. | 0,4 |
| `grave` | Un "whoomp" de cuerpo entre 80 y 200 Hz que baja de tono, con un poco de aire arriba; 0,5 s. | Un cambio de sección o de tema, no cada movimiento. Pide parlantes que lleguen a 100 Hz; en un celular queda el aire y el armónico. | 0,4 |
| `papel` | Roce de hoja que se desliza: seco y granulado, de 1 a 3,5 kHz, 280 ms, sin tono. | Paneles de interfaz que se deslizan o se levantan; el más seco y el menos "de cine". | 0,5 |

Regla práctica: una transición sonora por cambio de tema, no por movimiento. Si todavía hay demasiados, `mezcla --gain barrido-aire=0.5` baja la clase entera, y quitar los cues de los movimientos chicos deja solo los que importan. Con `"ancla": "pico"` el pico de `aire`, `suave` y `papel` (que llegan a su máximo antes de la mitad) cae en el cuadro del cue; sin ancla, lo que cae en el cuadro es el comienzo, que es casi silencio. Las variantes y las medidas están en `audio/efectos.ts` (`BARRIDOS`) y `audio/efectos.test.ts`.

## Empalme: el cuerpo de la pista

Una pista tiene casi siempre una intro baja y una caída final (un fade-out o una cola). Si el lazo se arma con el último compás entero del archivo, el empalme cae dentro de esa cola: pasar de la cola casi muda al arranque fuerte del lazo es un salto de decenas de dB y se oye como un hueco de un segundo o más. Por eso `empalme` mide el nivel de la pista (RMS en ventanas de 0,5 s) y define el **cuerpo**: desde donde termina una intro más de 12 dB por debajo del nivel típico hasta donde empieza una caída de más de 6 dB. El lazo se arma dentro del cuerpo: termina en el último compás entero antes de la caída y, si la pista tiene una intro baja, esa intro suena una sola vez y el lazo vuelve al primer compás del cuerpo. El JSON de salida trae `cuerpo` (`inicioSec`, `finSec`, `colaSec`, `introBaja`) y `loopStartSec`/`loopEndSec`. `--sin-cuerpo` vuelve al comportamiento anterior (pista entera).

- **A mano**: `--lazo-inicio <seg>` y `--lazo-fin <seg>` ubican el lazo; se ajustan al compás más cercano contando desde el pulso de inicio. `--inicio` es donde arranca la salida; el lazo puede empezar más adelante (la parte anterior suena una vez).
- **Empalme en un cambio de escena**: `--corte-en 12.5,f450` pide un empalme cerca de esos instantes de la salida (segundos, o cuadros con prefijo `f`). Se ubica en el compás de salida más cercano: el tramo en curso se corta ahí y vuelve al comienzo del lazo. Se pueden pasar varios, separados por comas, y se respetan TODOS: cada uno queda cubierto por un empalme a menos de medio compás (el JSON trae `cortes`: por cada pedido, `empalme`, el cuadro del empalme que lo cubre, o el motivo si no hizo falta). Dos cortes dentro de un mismo compás comparten un empalme (aviso); uno a menos de medio compás del comienzo o del final del video no necesita empalme (aviso); si la pista alcanza para la duración no hay empalmes y se avisa que se ignoran. Si un corte no se puede respetar (con `--final real`, cuando no queda lugar para el último lazo y la cola, o uno que cae después del final) el comando falla con un mensaje que lo nombra y dice qué hacer: nunca se ignora en silencio. Un empalme siempre se oye un poco: mejor que caiga sobre un corte de escena.
- **Entrada y salida**: `--fade-in <seg>` (por defecto 0,3 s si la salida no arranca en el comienzo del archivo; `--fade-in 0` lo apaga, un valor chico como 0,01 solo evita el clic de un corte en seco). `--fade <seg>` es la caída final (2 s).
- **Final real** (`--final real`): cuando el video dura más que la pista, en lugar de una caída artificial se toca al último el final propio de la pista (su cola y su fade). Para que quepa se rellena con los últimos compases del lazo y sobra, como mucho, un compás de silencio al final: el JSON trae `silencioFinalSec` y avisa si pasa de 1,5 s. Si el video cabe dentro de la pista, no hay nada que repetir y se usa la caída normal. Por defecto es `--final fade`.
- **Salida sin recortes**: los cruces y los picos de un mp3 pueden pasar de 0 dBFS. El archivo intermedio se escribe en 24 bits y, si el pico pasa de 0,98, se baja todo con una ganancia fija (`headroomDb` en el JSON) en lugar de recortar. No hay compresión ni limitador acá: el límite de pico se aplica una sola vez, al final, en `mezcla`.

## Fase, percusión y secciones

- **Fase del pulso.** Cuando hay platillos en las corcheas, la envolvente general empata el pulso con el contratiempo y la fase puede saltar medio pulso según el tramo que se analice. Se desempata con la banda grave (bajo 150 Hz): el bombo cae sobre el pulso. `phaseConfidence` (0 a 1) es la diferencia relativa entre la grilla elegida y la corrida medio pulso; por debajo de 0,05 la CLI avisa que la fase es ambigua. Si escuchás el empalme y los golpes caen en el contratiempo, repetí con `--fase medio`. Con `--offset` a mano la fase no se juzga. `--fase medio` solo se aplica en `tempo` y en `empalme` sin `--tempo` (con `--tempo`, el JSON ya trae la fase).
- **Inicio de la percusión.** Es el primer tramo con 4 golpes fuertes seguidos (separados por menos de 1,5 s). "Fuerte" es la mitad del percentil 95 de las alturas de los golpes de toda la pista, no del máximo: así el resultado casi no cambia si se recorta el final. Ojo: **el primer groove no es necesariamente donde entra la batería**. En una pista con una intro melódica, el primer tramo rítmico puede ser el del teclado y la batería recién entrar mucho después.
- **Secciones.** Para elegir el inicio sin adivinar, `tempo` lista todos los cambios que detecta en `secciones: [{ n, sec, frame, tipo, deltaDb, deltaGolpes }]`: `entrada` (la música sale de un tramo casi mudo), `percusion` (sube la densidad de golpes), `energia` (sube el nivel) y `caida` (baja el nivel o los golpes). Se calcula comparando los 4 s siguientes con los 4 s anteriores, a 8 s de separación como mínimo. `--inicio seccion:<n>` arranca en el pulso más cercano a la sección `n` (numeradas desde 1); `--inicio percusion` y `--inicio <seg>` siguen funcionando.

## Ducking

La música baja una cantidad fija mientras suena cada efecto; no depende de qué tan fuerte sea el efecto.

- `--duck-db` (5 por defecto): cuánto baja, en dB. `0` lo apaga.
- `--duck-ataque` (10 ms): la bajada termina justo cuando arranca el efecto (empieza 10 ms antes).
- `--duck-release` (250 ms): la subida empieza cuando el efecto deja de superar el umbral (amplitud 0,02, ya con el `gain` del cue) y vuelve a 0 dB en 250 ms. Las dos rampas van en dB con perfil de coseno.
- Un cue con `gain` menor a 0,1 no baja la música. Con `--duck-escala-gain` la profundidad se multiplica por el `gain` del cue (hasta 1).
- Dos efectos solapados no suman: manda el más profundo.

El ducking viejo (compresión por sidechain, razón 4) bajaba la música 16 a 20 dB bajo cada efecto y tardaba hasta cientos de milisegundos en recuperarla.

## Locución

La herramienta **no genera voz**. Lo que admite es una pista de voz que aporta la persona (un wav o un mp3 local, grabado por ella o con una licencia que permita usarlo donde se va a mostrar el video) y la trata como una capa más de la mezcla. El archivo vive en `videos/<slug>/audio/` (ignorado por git) y nunca se sube al repo ni a `public/`.

```bash
npm run audio -- mezcla --voz videos/<slug>/audio/locucion.wav --voz-en 0.5 \
  --musica videos/<slug>/audio/musica.wav --musica-gain 0.5 \
  --cues videos/<slug>/cues.json --sfx videos/<slug>/audio/sfx \
  --fps 30 --frames 900 --lufs -16 --out videos/<slug>/audio/audio-<slug>.wav
```

- **Dónde entra.** `--voz-en <seg>` es el segundo del VIDEO en que arranca la voz (0 por defecto); `--voz-desde <seg>` salta ese tramo del archivo (un silencio o una cuenta regresiva del comienzo). Lo que pasa del final del video se recorta con un aviso. Los bordes llevan 5 ms de fundido para que un corte seco no haga clic. `--voz-gain` es un multiplicador lineal (1 por defecto).
- **Ducking por voz.** La música baja `--voz-duck-db` dB (8 por defecto; `0` lo apaga) mientras habla la voz. La voz se detecta en la propia pista (`ventanasDeVoz`, `audio/voz.ts`): RMS en bloques de 10 ms con un umbral relativo al nivel típico de la grabación (28 dB por debajo), pausas de menos de `--voz-une` ms (350) unidas, así que entre palabras la música no bombea y sí entre frases, y tramos de menos de 80 ms descartados como un clic. `--voz-umbral <dBFS>` fija el umbral a mano si la grabación tiene ruido de fondo. La bajada empieza `--voz-ataque` ms (60) antes de la voz y la subida dura `--voz-release` ms (450) después. Con efectos y voz a la vez no se suman: manda el más profundo. Es la misma rampa en dB con perfil de coseno que el ducking de los efectos (`audio/dinamica.ts`); la prueba `audio/voz.test.ts` mide 10 dB de bajada con `--voz-duck-db 10` y la vuelta a 0 dB.
- **Sonoridad y pico.** La voz entra antes del normalizador y del limitador final: `--lufs` y `--techo` valen para la mezcla entera, voz incluida (para redes, `--lufs -16`; ver "Sonoridad y pico"). Avisa si la voz es muy baja (pico bajo -30 dBFS) o llega a 0 dBFS (puede venir recortada: el limitador no arregla un recorte que ya está en la grabación).
- **Solo voz.** Sin música ni cues alcanza con `--voz`.
- **Verificar contra los cortes de escena.** `npm run audio -- locucion --subtitulos videos/<slug>/subtitulos.json --escenas 150,120,90 --fps 30` avisa si una frase cruza o roza un corte (`cruza-corte`, `roza-corte`), si dos se pisan, si pasa del final o si pide más de 17 caracteres por segundo. Con `--voz locucion.wav --voz-en 0.5` revisa además los tramos donde HAY voz en la pista, que es lo que de verdad se oye. Detalle en `docs/subtitulos.md`.

### Flujo: del guion a la mezcla

1. **Guion**: el texto de cada escena queda en el guion (`videos/<slug>/guion.md`).
2. **Texto de locución por escena**: se escribe lo que se va a decir, pensado para decirse (frases cortas) y para leerse como subtítulo (a ritmo de 17 caracteres por segundo o menos). Se arma un `guion.json` (`[{ "texto": "...", "frames": 150 }, ...]`) y `subtitulos --guion` da un primer SRT con los tiempos repartidos por cantidad de palabras: sirve de pauta para grabar.
3. **La persona graba o aporta el audio.** Grabación propia, o una voz cuya licencia permita usarla donde se va a mostrar el video y redistribuirla; la herramienta no la genera ni la elige. Mejor un archivo por toma completa que uno por frase; con un wav a 48 kHz se evita el mp3 sin etiqueta (ver "mp3 sin etiqueta").
4. **Alineación**: los tiempos reales se ponen a mano en `subtitulos.json` (segundos, o cuadros con `"unidad": "cuadros"`), o llegan de un SRT/VTT que haga la persona con su editor de audio (`subtitulos mi-alineacion.srt --out videos/<slug>/subtitulos.json`). Con `locucion --voz` se ve dónde empieza y termina de verdad cada tramo de voz y se corrige el JSON.
5. **Verificar**: `locucion --subtitulos ... --escenas ... --voz ... --estricto` hasta que no avise nada (una frase que cruza un corte se parte o se corre el corte; el corte es del video, así que lo habitual es mover la frase o alargar la escena).
6. **Mezcla**: `mezcla --voz ...` como arriba, y `<Audio src={asset("audio-<slug>.wav")} />` en la escena raíz, como cualquier otra mezcla. Los subtítulos quemados salen de `<Subtitles />` (ver `docs/subtitulos.md`) y los archivos aparte de `subtitulos --junto-a out/<id>.mp4`.

## Sonoridad y pico

- **Limitador final**: de pico verdadero (sobremuestreo x4), techo `--techo` (-1 dBTP por defecto), de fase cero: se calcula mirando antes y después de cada cresta, así que no retrasa el audio ni una muestra (el limitador anterior corría todo 240 muestras). Si la mezcla ya cabe bajo el techo, no la toca.
- **`--lufs <objetivo>`**: normaliza la sonoridad integrada (BS.1770 / EBU R128, con compuertas) a ese valor antes del limitador. Sin la opción no se normaliza. Valores típicos: -16 LUFS para web, redes y celular; -14 LUFS para plataformas de video; -23 LUFS para televisión. Si el limitador frena una mezcla con picos fuertes, la sonoridad final queda debajo del objetivo y se avisa. La CLI imprime `sonoridadAntesLufs`, `gananciaLufsDb`, `reduccionLimitadorDb`, `sonoridadFinalLufs` y `picoVerdaderoDbtp`.
- **El AAC del mp4 puede pasarse del techo.** El techo de la mezcla vale para el WAV; el audio que termina en el mp4 es AAC (con pérdida) y decodificado puede tener crestas más altas: en un video real, una mezcla con techo -2 dBTP llegó a +0,9 dBTP. `render` mide el pico verdadero del audio YA decodificado del mp4 y avisa si supera `--audio-peak-max` (-1 dBTP por defecto), diciendo cuánto hay que bajar el techo (`mezcla --techo -3`); con `--audio-peak-strict` falla y no deja el mp4. Después de bajar el techo no se re-renderiza el video (el audio no entra en la clave de la cache de partes), solo se vuelve a multiplexar. `--audio-bitrate 256k` ayuda poco. Ver `render/README.md`, "Como funciona".
- **Mono y estéreo**: un efecto o una música mono se copia a los dos lados sin pérdida (ffmpeg, por defecto, les saca 3 dB). La mezcla final sale en 16 bits.

## Anclas de los cues

Algunos efectos tardan en llegar a su pico (un `barrido` sube hasta el medio). Con `"ancla": "pico"` el efecto se adelanta lo necesario para que su pico audible caiga en el cuadro del cue; con `"ancla": "inicio"` (por defecto) lo que cae en el cuadro es el comienzo del archivo. Si el pico queda antes del inicio del video, se recorta el comienzo del efecto. El ancla vale para cualquier archivo (el pico se mide al cargarlo: el centro de la ventana de 10 ms más fuerte).

| Efecto | Pico (ms desde el inicio) |
| --- | --- |
| `golpe` | 13 |
| `clic` | 5 |
| `barrido` | 385 |
| `campanita` | 8 |
| `tilde` | 95 |
| `aviso` | 18 |

Salen de `picosDeEfectos()` (en `audio/efectos.ts`) y de `efectos --lista`.

## mp3 sin etiqueta

Un mp3 sin la etiqueta Xing/LAME no dice cuántas muestras de retardo del codificador hay que descartar (unos 25 ms), así que según el decodificador la pista arranca antes o después. ffmpeg no las descarta. La CLI lo detecta con ffprobe (códec mp3 y `start_time` 0) y avisa. Lo más seguro es convertir la pista una vez a wav (`ffmpeg -i tema.mp3 tema.wav`) y usar ese wav en `tempo`, `empalme` y `mezcla`: todo se mide sobre las mismas muestras.

## Los efectos no se versionan

Los sonidos se generan a pedido con fórmulas propias (sin muestras de terceros), de forma determinista. No se suben binarios al repo: `public/sfx/` (valor por defecto de `efectos --out`) está ignorado, y lo mismo vale para las salidas de `empalme` y `mezcla`, que van a `videos/<slug>/audio/`. Las salidas se escriben a un archivo temporal junto al destino y se renombran al terminar: si ffmpeg falla no queda un archivo a medias.

## Licencias

- Ninguna música, efecto ni muestra de terceros entra al repo. Los efectos son propios.
- Antes de usar una pista, verificá que su licencia permita usarla donde se va a mostrar el video y redistribuirla (incluido el video renderizado). Si hay que atribuir, ponelo en la descripción del video, no en el repo.
- La **voz** es de la persona que la aporta: propia, o con una licencia que permita usarla donde se va a mostrar el video y redistribuirla. Una voz sintetizada con un servicio de terceros trae sus propios términos (a veces prohíben el uso comercial o piden atribución): verificalos antes de usarla. La herramienta no incluye ni genera voces, y el archivo nunca va al repo.
- Los textos de ejemplo y los nombres de archivo no llevan nombres reales de artistas, empresas o personas.

## Límites

- **Música sin pulso claro o con rubato** (clásica, ambient, tempo que cambia): la estimación da un BPM con confianza baja o equivocado. La grilla es de tempo constante: no sigue cambios de tempo.
- **Octavas**: puede devolver la mitad o el doble del tempo real (70 en lugar de 140). Hay una preferencia por tempos cerca de 120. Si `bpm` queda en la octava equivocada, forzalo.
- **Compás**: `empalme` asume 4 pulsos por compás contados desde el pulso de inicio; usá `--compas 3` para valses. No detecta el primer tiempo del compás: si el tema empieza en un contratiempo, elegí el inicio a mano (`--inicio <seg>`).
- **Percusión**: se toma como el primer tramo con al menos 4 golpes fuertes seguidos separados por menos de 1,5 s. Una intro con golpes aislados o una percusión muy suave puede no detectarse (`percussionStart: null`); en ese caso usá `--inicio seccion:<n>` o `--inicio <seg>`.
- **Fase**: con bombo a contratiempo (reggae, dub) o sin bombo marcado, el desempate por el grave puede elegir mal; `phaseConfidence` baja avisa y `--fase medio` lo corrige.
- **Corrección a mano**: `--bpm` y `--offset` (segundo del primer pulso) reemplazan la estimación y marcan el resultado como `manual`. Con `--bpm` solo, la herramienta busca la mejor fase; con ambos, usa la grilla tal cual. Después de forzar, verificá escuchando el empalme.
- **Empalme**: el tramo que se repite va desde el pulso de inicio (o el primer compás del cuerpo) hasta el último compás entero del cuerpo, antes de la caída final; un resto de menos de 0,25 s se absorbe en el tramo anterior solo si la pista alcanza a darlo; si no, queda como un tramo corto propio (nunca se lee más allá del fin de la pista). La caída final no necesita estar en un pulso. Un empalme forzado con `--corte-en` salta desde la mitad del lazo: si el tema tiene frases de 4 u 8 compases se nota más que uno al final de la frase.
- La confianza (`confidence`) es una heurística entre 0 y 1: no es una probabilidad. Por debajo de 0,3 `empalme` avisa y sigue; con 0 (silencio o señal sin pulso, donde la grilla sería inventada) se niega y pide pasar `--bpm` y `--offset`. Lo forzado a mano no se juzga.
- Las herramientas decodifican con ffmpeg, así que aceptan lo que ffmpeg acepte; las pistas muy largas tardan más en analizarse (el costo crece con la duración).

## Pruebas

`render/audio.e2e.test.ts` (lenta, `npm run test:e2e`) renderiza un video con una pista sintética de clics (generada en la prueba): mide el pico del AAC y su aviso y su modo estricto, verifica que cambiar solo el audio no re-renderiza ninguna parte, y que `--frames` y `--seconds` dan un extracto con los clics en el mismo instante que en el video completo. `audio/empalme.test.ts` incluye una propiedad con cientos de combinaciones de tempo, compás y cortes: todo `--corte-en` queda cubierto por un empalme. `audio/mouse.test.ts` mide el clic de mouse sin archivos de nadie: dos eventos (o uno, o cuatro) a la separación documentada con un detector de onsets, 90 % de la energía de cada evento en menos de 25 ms, planitud espectral por bandas de tercio de octava (1 a 8 kHz) de al menos 0,15 por evento frente a menos de 0,1 de un tono amortiguado de control, menos de 5 % de la energía bajo 300 Hz y variantes distinguibles. `audio/*.test.ts` usan señales sintéticas generadas en la prueba (trenes de clics, colchones, un patrón de bombo y platillos, senos), sin archivos externos ni música de nadie. Hay pruebas puras (planificadores, argumentos, `beats.ts`, ducking, limitador, sonoridad, efectos) y pruebas de punta a punta con ffmpeg (se omiten con un aviso si ffmpeg no está en el PATH) que verifican la duración (±1 cuadro), que los empalmes caen sobre pulsos y dentro del cuerpo, que el escalón de nivel en un empalme es comparable al de un pulso común, que el ducking baja lo pedido (±1 dB) y se recupera, que un impulso cae en la muestra exacta del cue, que el pico verdadero queda bajo el techo y que `--lufs` llega al objetivo. `audio/efectos.test.ts` también verifica las variantes del barrido: pico en -6 dBFS, extremos en cero, sin continua, que `aire` y `suave` tarden al menos 40 ms en llegar a la mitad de su envolvente, que ninguna tenga más del 10 % de su energía sobre 5 kHz, y la tabla `--gain` (`args.test.ts` y `mezcla.test.ts`). `audio/voz.test.ts` prueba la locución con una pista sintética (`pistaDeVoz` en `audio/pistas-de-prueba.ts`, un tono armónico con envolvente silábica generado en la prueba): detección de frases y de pausas, ubicación en el video, ducking medido con resta de pistas (10 dB abajo mientras habla, 0 dB antes y después), `--lufs` y techo sobre la mezcla con voz, y los avisos de corte de escena. Ningún archivo de voz entra al repo. `audio/medidas.ts` reúne las medidas (FFT, RMS, espectro por bandas, pico verdadero) que usan las pruebas.
