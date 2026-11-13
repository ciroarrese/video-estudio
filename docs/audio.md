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
| `efectos` | Necesitás sonidos cortos (golpe, clic, barrido, campanita, tilde, aviso). | WAV sintetizados, originales, en la carpeta que elijas. |
| `mezcla` | Tenés una lista de momentos (cues) y, opcionalmente, música. | Un solo archivo de audio listo para usar como pista del video. |
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

**Una sola carpeta de salida.** Todo lo que genera `empalme` (la pista y su JSON) y `mezcla` (el WAV final) va a `videos/<slug>/audio/`, junto con `sfx/`; `tempo.json` y `cues.json` quedan en `videos/<slug>/`. Así `--assets videos/<slug>/audio` encuentra los archivos y nada pasa por `public/`.

Si usás `empalme` y `mezcla` juntos, los cuadros de los cues se miden en el tiempo del video, igual que `beatFrames` de la salida de `empalme`. `beatFrames` son números fraccionarios (un pulso rara vez cae justo en un cuadro); las funciones de `beats.ts` los aceptan tal cual.

## Sin música: plan de cues

Con solo efectos el sonido queda flaco si cada uno suena aislado. Un plan que alcanza para un video corto (30 a 60 s):

- **Una acción clave, un sonido**: `clic` en el cuadro de cada clic del cursor, `tilde` cuando algo queda hecho o aprobado, `aviso` cuando aparece un resultado o una alerta, `campanita` para un logro (una vez, no más).
- **Una transición, un `barrido`**: en el primer cuadro del atravesado (`zoomThrough`) o del velo (`Wash`) de cada escena.
- **Un `golpe` suave** (`"gain": 0.5` a `0.7`) en el título de la apertura y otro en el cierre.
- Dejá aire: unos 8 a 10 cuadros entre efectos, salvo un redoble pensado, y bajá el `gain` (0,6 a 0,8) de los que se repiten.

Música: es opcional y la decide la persona; la pista y su licencia las trae ella (ver "Licencias"). Con música, los efectos bajan la música solos 5 dB mientras suenan (ver "Ducking").

## Comandos y opciones

Todas las opciones numéricas se validan: un valor que no es número, una bandera sin valor (`--inicio` a secas) o un valor fuera de rango (`--fps 0`, `--compas 2.5`) cortan con un error claro antes de procesar nada. Las rutas se resuelven a absolutas, así que un archivo que empiece con `-` no se confunde con una opción de ffmpeg.

- `tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--fase medio] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]`. Entrega `bpm`, `confidence`, `phaseConfidence`, `beatsSec`, `beatFrames`, `percussionStart`, `percussionBeat` y `secciones` (ver "Fase, percusión y secciones").
- `empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S) [--inicio percusion|seccion:<n>|<seg>] [--tempo tempo.json | --bpm N --offset seg [--fase medio]] [--lazo-inicio seg] [--lazo-fin seg] [--corte-en seg|f<cuadro>[,...]] [--final fade|real] [--compas 4] [--cruce 0.04] [--fade 2] [--fade-in 0.3] [--sin-cuerpo] [--sr 48000] [--json plan.json]`. El formato de salida lo da la extensión (`.wav`, `.mp3`, `.m4a`); el wav sale en 24 bits. Sin `--tempo` ni `--bpm` analiza la pista él mismo. Si la pista alcanza para la duración, solo recorta (sin empalmes). `--inicio` se ajusta al pulso más cercano. Detalle en "Empalme: el cuerpo de la pista".
- `efectos [--out public/sfx] [--lista]`. Genera `golpe`, `clic`, `barrido`, `campanita`, `tilde` y `aviso` (WAV mono de 16 bits, 48 kHz). `--lista` los nombra con el instante de su pico.
- `mezcla --cues cues.json --fps F --frames N --out audio.wav [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg] [--fade-in seg] [--fade-out 1] [--duck-db 5] [--duck-ataque 10] [--duck-release 250] [--duck-escala-gain] [--lufs <objetivo>] [--techo -1] [--sr 48000]`. En un cue, `sfx` es un nombre del set (se busca `<--sfx>/<nombre>.wav`) o una ruta a cualquier archivo; `gain` es un multiplicador lineal (1 por defecto); `ancla` es `"inicio"` (por defecto) o `"pico"`. Un cue fuera del video se omite con un aviso; un efecto que no existe corta antes de procesar nada, nombrando el cue. La salida tiene exactamente la duración del video y un limitador de pico verdadero. `--duck N` (la vieja razón de compresión) se sigue aceptando: `--duck 0` apaga el ducking y cualquier otro valor se ignora con un aviso.

## Empalme: el cuerpo de la pista

Una pista tiene casi siempre una intro baja y una caída final (un fade-out o una cola). Si el lazo se arma con el último compás entero del archivo, el empalme cae dentro de esa cola: pasar de la cola casi muda al arranque fuerte del lazo es un salto de decenas de dB y se oye como un hueco de un segundo o más. Por eso `empalme` mide el nivel de la pista (RMS en ventanas de 0,5 s) y define el **cuerpo**: desde donde termina una intro más de 12 dB por debajo del nivel típico hasta donde empieza una caída de más de 6 dB. El lazo se arma dentro del cuerpo: termina en el último compás entero antes de la caída y, si la pista tiene una intro baja, esa intro suena una sola vez y el lazo vuelve al primer compás del cuerpo. El JSON de salida trae `cuerpo` (`inicioSec`, `finSec`, `colaSec`, `introBaja`) y `loopStartSec`/`loopEndSec`. `--sin-cuerpo` vuelve al comportamiento anterior (pista entera).

- **A mano**: `--lazo-inicio <seg>` y `--lazo-fin <seg>` ubican el lazo; se ajustan al compás más cercano contando desde el pulso de inicio. `--inicio` es donde arranca la salida; el lazo puede empezar más adelante (la parte anterior suena una vez).
- **Empalme en un cambio de escena**: `--corte-en 12.5,f450` pide un empalme cerca de esos instantes de la salida (segundos, o cuadros con prefijo `f`). Se ubica en el compás de salida más cercano: el tramo en curso se corta ahí y vuelve al comienzo del lazo. Se pueden pasar varios, separados por comas. Un empalme siempre se oye un poco: mejor que caiga sobre un corte de escena.
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

## Sonoridad y pico

- **Limitador final**: de pico verdadero (sobremuestreo x4), techo `--techo` (-1 dBTP por defecto), de fase cero: se calcula mirando antes y después de cada cresta, así que no retrasa el audio ni una muestra (el limitador anterior corría todo 240 muestras). Si la mezcla ya cabe bajo el techo, no la toca.
- **`--lufs <objetivo>`**: normaliza la sonoridad integrada (BS.1770 / EBU R128, con compuertas) a ese valor antes del limitador. Sin la opción no se normaliza. Valores típicos: -16 LUFS para web, redes y celular; -14 LUFS para plataformas de video; -23 LUFS para televisión. Si el limitador frena una mezcla con picos fuertes, la sonoridad final queda debajo del objetivo y se avisa. La CLI imprime `sonoridadAntesLufs`, `gananciaLufsDb`, `reduccionLimitadorDb`, `sonoridadFinalLufs` y `picoVerdaderoDbtp`.
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

`audio/*.test.ts` usan señales sintéticas generadas en la prueba (trenes de clics, colchones, un patrón de bombo y platillos, senos), sin archivos externos ni música de nadie. Hay pruebas puras (planificadores, argumentos, `beats.ts`, ducking, limitador, sonoridad, efectos) y pruebas de punta a punta con ffmpeg (se omiten con un aviso si ffmpeg no está en el PATH) que verifican la duración (±1 cuadro), que los empalmes caen sobre pulsos y dentro del cuerpo, que el escalón de nivel en un empalme es comparable al de un pulso común, que el ducking baja lo pedido (±1 dB) y se recupera, que un impulso cae en la muestra exacta del cue, que el pico verdadero queda bajo el techo y que `--lufs` llega al objetivo. `audio/medidas.ts` reúne las medidas (FFT, RMS, espectro por bandas, pico verdadero) que usan las pruebas.
