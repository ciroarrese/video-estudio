# Audio

Herramientas de línea de comandos para ponerle sonido a un video: detectar el tempo de una pista, empalmarla al compás para que dure lo mismo que el video, sintetizar efectos propios y mezclarlo todo en un solo archivo. Viven en `audio/` y usan ffmpeg (tiene que estar en el PATH) y TypeScript con `tsx`; no agregan dependencias de npm.

```bash
npx tsx audio/cli.ts <comando> ...     # o, si está el script: npm run audio -- <comando> ...
```

## Cuándo usar cada una

| Herramienta | Usala cuando | Entrega |
| --- | --- | --- |
| `tempo` | Tenés una pista y necesitás saber dónde caen los pulsos y dónde entra la percusión. | JSON con BPM, confianza, pulsos en segundos y en cuadros, inicio de la percusión. |
| `empalme` | La pista no dura lo que el video, o querés arrancar justo en la percusión. | Un archivo de audio de la duración exacta, con inicio y empalmes sobre pulsos, y los cuadros de cada pulso. |
| `efectos` | Necesitás sonidos cortos (golpe, clic, barrido, campanita, tilde, aviso). | WAV sintetizados, originales, en la carpeta que elijas. |
| `mezcla` | Tenés una lista de momentos (cues) y, opcionalmente, música. | Un solo archivo de audio listo para usar como pista del video. |
| `audio/beats.ts` | Querés que una animación caiga sobre el compás. | Funciones puras: `beatAt`, `beatPhase`, `nearestBeat`, `pulse`, `framesPerBeat`. |

## Flujo para un video

1. **Elegir el tema con licencia verificada.** Que permita usarlo donde se va a mostrar el video y redistribuirlo. Anotá de dónde salió y bajo qué licencia. Nunca se sube música al repo.
2. **`tempo`**: `npx tsx audio/cli.ts tempo tema.mp3 --fps 30 --out videos/<slug>/tempo.json`. Mirá `bpm` y `confidence`; si es baja, revisá el apartado de límites.
3. **`empalme`**: `npx tsx audio/cli.ts empalme tema.mp3 --frames 900 --fps 30 --inicio percusion --tempo videos/<slug>/tempo.json --out videos/<slug>/musica.wav --json videos/<slug>/musica.json`. Arranca sobre el pulso donde entra la percusión, repite compases enteros si la pista es corta (cruce de potencia constante de 40 ms en cada empalme) y cierra con una caída de 2 s. Imprime `beatFrames` y `spliceFrames`.
4. **`efectos`**: `npx tsx audio/cli.ts efectos --out public/sfx`. Ver `--lista` para los nombres.
5. **`mezcla`**: con un `cues.json` como `[{"frame": 45, "sfx": "clic"}, {"frame": 120, "sfx": "tilde", "gain": 0.7}]`:
   `npx tsx audio/cli.ts mezcla --cues videos/<slug>/cues.json --fps 30 --frames 900 --musica videos/<slug>/musica.wav --musica-gain 0.5 --out public/audio-<slug>.wav`.
6. **Usar el archivo en el video**: `<Audio src={asset("audio-<slug>.wav")} />` en la escena raíz (el motor lo busca en `public/` o en `--assets`), y los `beatFrames` de `musica.json` para sincronizar animaciones:

```tsx
import { pulse, nearestBeat } from '../../audio/beats';
const beats = musica.beatFrames;            // del JSON de empalme: ya están en tiempo de salida
const frame = useFrame();
const escala = 1 + 0.06 * pulse(frame, beats, 0.25);
```

Si usás `empalme` y `mezcla` juntos, los cuadros de los cues se miden en el tiempo del video, igual que `beatFrames` de la salida de `empalme`. `beatFrames` son números fraccionarios (un pulso rara vez cae justo en un cuadro); las funciones de `beats.ts` los aceptan tal cual.

## Comandos y opciones

- `tempo <archivo> [--fps 30] [--bpm N] [--offset seg] [--min-bpm 60] [--max-bpm 190] [--out tempo.json]`.
- `empalme <archivo> --out salida.wav (--frames N --fps F | --segundos S) [--inicio percusion|<seg>] [--tempo tempo.json | --bpm N --offset seg] [--compas 4] [--cruce 0.04] [--fade 2] [--sr 48000] [--json plan.json]`. El formato de salida lo da la extensión (`.wav`, `.mp3`, `.m4a`). Sin `--tempo` ni `--bpm` analiza la pista él mismo. Si la pista alcanza para la duración, solo recorta (sin empalmes). `--inicio` se ajusta al pulso más cercano.
- `efectos [--out public/sfx] [--lista]`. Genera `golpe`, `clic`, `barrido`, `campanita`, `tilde` y `aviso` (WAV mono de 16 bits, 48 kHz).
- `mezcla --cues cues.json --fps F --frames N --out audio.wav [--sfx public/sfx] [--musica archivo] [--musica-gain 0.6] [--musica-desde seg] [--fade-in seg] [--fade-out 1] [--duck 4] [--sr 48000]`. En un cue, `sfx` es un nombre del set (se busca `<--sfx>/<nombre>.wav`) o una ruta a cualquier archivo; `gain` es un multiplicador lineal (1 por defecto). Con música, los efectos bajan la música por sidechain (`--duck` es la razón de compresión; `--duck 0` lo apaga). Un cue fuera del video se omite con un aviso. La salida tiene exactamente la duración del video y un limitador que evita el clipping.

## Los efectos no se versionan

Los sonidos se generan a pedido con fórmulas propias (sin muestras de terceros), de forma determinista. No se suben binarios al repo: `public/sfx/` se genera cuando hace falta y no se commitea. Lo mismo vale para las salidas de `empalme` y `mezcla`.

## Licencias

- Ninguna música, efecto ni muestra de terceros entra al repo. Los efectos son propios.
- Antes de usar una pista, verificá que su licencia permita usarla donde se va a mostrar el video y redistribuirla (incluido el video renderizado). Si hay que atribuir, ponelo en la descripción del video, no en el repo.
- Los textos de ejemplo y los nombres de archivo no llevan nombres reales de artistas, empresas o personas.

## Límites

- **Música sin pulso claro o con rubato** (clásica, ambient, tempo que cambia): la estimación da un BPM con confianza baja o equivocado. La grilla es de tempo constante: no sigue cambios de tempo.
- **Octavas**: puede devolver la mitad o el doble del tempo real (70 en lugar de 140). Hay una preferencia por tempos cerca de 120. Si `bpm` queda en la octava equivocada, forzalo.
- **Compás**: `empalme` asume 4 pulsos por compás contados desde el pulso de inicio; usá `--compas 3` para valses. No detecta el primer tiempo del compás: si el tema empieza en un contratiempo, elegí el inicio a mano (`--inicio <seg>`).
- **Percusión**: se toma como el primer tramo con al menos 4 golpes seguidos separados por menos de 1,5 s. Una intro con golpes aislados o una percusión muy suave puede no detectarse (`percussionStart: null`); en ese caso usá `--inicio <seg>`.
- **Corrección a mano**: `--bpm` y `--offset` (segundo del primer pulso) reemplazan la estimación y marcan el resultado como `manual`. Con `--bpm` solo, la herramienta busca la mejor fase; con ambos, usa la grilla tal cual. Después de forzar, verificá escuchando el empalme.
- **Empalme**: el tramo que se repite va desde el pulso de inicio hasta el último compás entero de la pista; un resto de menos de 0,25 s se absorbe en el tramo anterior. La caída final no necesita estar en un pulso.
- La confianza (`confidence`) es una heurística entre 0 y 1: no es una probabilidad. Por debajo de 0,3 desconfiá.
- Las herramientas decodifican con ffmpeg, así que aceptan lo que ffmpeg acepte; las pistas muy largas tardan más en analizarse (el costo crece con la duración).

## Pruebas

`audio/*.test.ts` usan señales sintéticas generadas en la prueba (trenes de clics y colchones), sin archivos externos. Hay pruebas puras (planificadores, `beats.ts`) y pruebas de punta a punta con ffmpeg que verifican la duración (±1 cuadro), que los empalmes caen sobre pulsos y que el pico de energía de cada cue cae en su cuadro.
