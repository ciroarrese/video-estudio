# video-estudio: plan

## Estado

Etapa 1 entregada y buena parte de las siguientes, salvo lo que figura como pendiente.

- Hecho: motor (`useFrame`, `interpolate` con curvas, `random(seed)`, `Series`/`Sequence`, audio, espera de recursos, `checkDeterminism`, `FrameCanvas`); render con Chromium y ffmpeg, en paralelo y por partes con caché; temas (neutro, oscuro, adaptador de tokens con informe y chequeo de contraste); kit base (cámara con cuadros clave, desenfoque e inclinación, cursor, garabatos, viñeta, titular que se aparta, vuelo de tarjetas, velo); historias (apertura, vuelta al listado y cierre desde un `StorySpec`, con profundidad por elemento); skill `video-estudio` con el cuestionario y las etapas con aprobación; `docs/reglas.md`, `docs/guia-escenas.md`, plantillas en `templates/` y `CLAUDE.md`.
- Adelantado de la etapa 2: control de calidad (`ve-qa`, siete reglas), hoja de cuadros (`ve-sheet`) y chequeo de privacidad (`ve-privacy`).
- Hecho de las etapas siguientes: **catálogo de efectos** en `fx/` (texto, 3D, datos, interfaz y arte, con tres galerías y `docs/animaciones.md`); **resortes y curva de aterrizaje** (`Easing.back`, `Easing.lands`); **trazados parciales** (dibujar y recorrer trazados: `LineDraw`, `FlowSteps`, `BlueprintDraw`, `LogoLand`, `MarkerDraw`); **piezas de interfaz** (notificaciones, chat, paleta de comandos, teléfono, antes/después, baldosas); medición de texto (`fitText`).
- Hecho después: registro automático de videos (`examples/*` y `videos/*` por `import.meta.glob`, `render --list`, error claro por `id` repetido); formatos horizontal, vertical y cuadrado (`formats` en `defineVideo`, `useFormat()`, `--format`; apertura, vuelta al listado y cierre de `stories/` adaptados); render, QA y hoja de una escena suelta (`--scene`, `--list-scenes`); caché de partes por video; carpeta `audio/` (tempo, empalme al compás, efectos de sonido propios y mezcla, ver `docs/audio.md`); tema por escena (`ThemeScope`).
- Hecho también: prueba de aceptación de la migración con dos escenas reales (una equivalente y otra distinta a propósito por diseño, que ahora se alcanza con las opciones de `spec.design`: cartel de vidrio, lista en un renglón, acople de la píldora, muro y nubes); prueba de audio con música real y sus arreglos (secciones de `tempo`, lazo y corte a mano, final real, ducking en dB, `--lufs` y techo de pico verdadero, ancla de los cues); `theme.data`, `type.ui`, nubes por tokens y pares de marca reconocidos (`acknowledge`); historias parciales; videos en una carpeta fuera del repo (`VE_VIDEOS_DIR`, `templates/externo`, `npm run typecheck:videos`); pruebas rápidas (`npm test`) separadas de las lentas (`npm run test:e2e`).
- Pendiente, con el motivo: repetir la prueba de equivalencia con las opciones de diseño ya disponibles (el comparador contra otro motor no existe; `render --check` solo compara el render consigo mismo); subtítulos (se probaron y se sacaron: compiten con la imagen, solo a pedido); vista previa interactiva (hoy se mira con `npm run dev`, sin línea de tiempo ni controles); caché de render por escena (descartada por ahora: el caché por partes de cada video alcanza, ver `render/README.md`); Lottie y video embebido (etapa 4, sin empezar); `backdrop-filter` sin probar bajo `--check` (el vidrio del cartel es una superficie semiopaca a propósito); píldoras del cierre con nombres de más de 40 caracteres (probado hasta 40; ver `stories/README.md`).
- Hecho en la etapa 2 y después de dos pruebas en frío (dos videos hechos de punta a punta siguiendo solo la skill): `stories/` con `TopicHeadline` fuera de la historia, `useTopic(fallback?)`, `defineStory` que publica solo el formato base salvo `formats`, `theme` como nombre u objeto (pisable con `--props`), `signoff.slot`, vuelta compacta (`interludes: "compact"`, 40 cuadros, mínimo 24), miniatura por defecto que varía por tema, píldoras del cierre acotadas al 80 % del ancho, presupuesto de cuadros (`storyBudget`, `formatStoryBudget`, `budgetFromScenes`; `qa`/`sheet --list-scenes` lo imprimen); `FlyingCard` que no se dibuja antes de su rango (`hideBefore`); `qa` con severidad de `offscreen` y del velo en `contrast`, fundidos, cruces en movimiento, rebabas bajo cámara en movimiento y texto bajo un `Wash` a medio fundido como `info`, `--out` en `ve-qa`/`ve-sheet`/`ve-privacy` y `DENY-JOINED` en privacidad (texto unido entre vecinos en línea, con límites de palabra); efectos de `fx/` sin residuos antes de `start` ni después de terminar; `--check` que ignora el orden de atributos, clases y estilos; render que tolera un video roto, rechaza tamaños impares y nombra `--keep-frames` por formato y escena; documentación y plantillas alineadas con el código.
- Hecho: **sistema de diseño** (`theme.style`): capa de estilo con ayudas puras (`surfaceStyle`/`surfaceParts`, `cornerRadius` con roles `chip`, `card`, `panel`, `window`, `hero`, `control`, `bar`, `borderWidth` con `bold` y cartel con `outline`, `textStyle` con `strong`, `entrance` con `curve` y `offset`, `chartStyle`, `cameraOptions`...), tres design systems de ejemplo, `kit/`, `stories/` y `fx/` migrados con el estilo por defecto idéntico píxel a píxel, `checkTheme` que revisa también `line`, `solid`, `depth` y `text`, `useFx().style`, `docs/estilo.md` con exenciones y desvíos, skill y plantillas que empiezan por el design system. Pendiente: nuevo `examples/design-systems` (la misma escena bajo los cuatro temas en tres formatos) y el selector de tema por `--props` en `examples/theme-scope`.
- Calidad (etapa 5, revisión): los resultados de `qa` anteriores a esta revisión eran poco confiables en videos con una viñeta de cuadro completo (el control no miraba el texto de abajo) y las marcas `data-qa-ignore` anchas escondían más; se corrigió el control, se agregó la línea `juzgados` y se **volvieron a correr** `kit-demo`, `theme-scope`, `story-demo`, `fx-in-scene` y la plantilla bajo los cinco design systems: 0 errores y 0 avisos con la tipografía por defecto. Hecho: ayudas `dimOpacity`/`dimmedColor`, `Callout` con `placeBeside`/`calloutState`/`coveredOpacity`, `textWidth`, `headlineStrip` y `cameraKeepClear`; `docs/guia-escenas.md` sección 15. Pendiente: (1) `--font-scale` acumula la escala en elementos con tamaño redondo (ver la sección 15; es un defecto de `qa/session.ts`, aún sin corregir; por eso las cifras de estrés anteriores, 29 y 460 errores, estaban infladas); (2) `fx-in-scene` juzga solo 7 % del texto (grilla de 3 x 3, por diseño) y los efectos de `fx/` traen sus propias marcas `data-qa-ignore`; (3) con el estrés de tipografía `kit-demo` da avisos de `offscreen` de las filas vecinas bajo el zoom.
- Definido: licencia MIT; `videos/` queda fuera del repo y un video propio no deja cambios locales en el motor.

Herramienta propia para generar videos animados de nivel profesional a partir de un cuestionario, con el design system como variable. Nace de la experiencia de producir un video anterior, hecho a mano escena por escena.

## Principios

- **Motor propio, escrito desde cero.** No se copia código de Remotion (su licencia no lo permite). Solo se replican ideas generales: un video es una función del número de cuadro.
- **Todo depende del cuadro.** Nada de animaciones CSS ni temporizadores: el render tiene que dar siempre el mismo resultado.
- **Proceso guiado con aprobaciones.** Cuestionario → fichas → guion → escena por escena → armado final. El agente no produce el video de una sola pasada.
- **Privacidad por defecto.** Números emulados y nombres ficticios salvo que el usuario pida lo contrario; credenciales nunca impresas ni subidas.
- **El design system es un tema intercambiable.** Ninguna pieza del kit trae colores ni tipografías fijos.

## Estructura del repo

```
engine/     reloj de cuadros, interpolación, resortes, azar determinista, secuencias,
            espera de recursos, render (Chromium + ffmpeg), render por partes
kit/        cámara, cursor, garabatos, acercamientos, titular, transiciones,
            trazados, medición de texto, piezas de interfaz
themes/     adaptador de tokens + un tema neutro de ejemplo
stories/    apertura con titulares, vuelta al listado con tilde, cierre (desde configuración)
audio/      detección de tempo, empalme al compás, efectos de sonido
qa/         control de calidad, chequeo de privacidad, hoja de cuadros
examples/   un video corto genérico, con datos ficticios
.claude/    skill `video-estudio` (cuestionario y etapas) y definiciones de agentes
docs/       reglas aprendidas, guía de escenas, decisiones
```

## Etapas

Cada etapa termina con una prueba que se puede correr y una revisión del usuario.

### Etapa 1: lo mínimo para rehacer un video
1. Motor: `useFrame`, `interpolate` con curvas, `random(seed)`, `Series`/`Sequence`, audio, espera de recursos.
2. Render: una captura por cuadro con Chromium, armado con ffmpeg, en paralelo y por escena (solo se vuelve a renderizar lo que cambió).
3. Temas: adaptador de tokens y tema neutro.
4. Kit base migrado: cámara con cuadros clave, desenfoque e inclinación; cursor; garabatos; viñeta; titular que se aparta.
5. Historias: apertura, vuelta al listado y cierre desde un archivo de configuración.
6. Skill con el cuestionario y las etapas.
- **Prueba:** una escena de ejemplo renderizada con el motor propio, comparada cuadro a cuadro contra la misma escena en Remotion (diferencia de píxeles bajo un umbral).

### Etapa 2: calidad
Resortes, transiciones entre escenas, trazados (dibujar, recorrer, transformar), medición y ajuste de texto, control de calidad automático (textos cortados o superpuestos, área segura, tamaño mínimo, contraste), hoja de cuadros automática.
- **Prueba:** el control de calidad detecta los defectos sembrados en una escena de prueba.

### Etapa 3: impacto
Música al compás automática, efectos de sonido sincronizados (con licencia verificada), piezas de interfaz (navegador, teléfono, tabla, gráfico, chat), varios formatos (16:9, vertical, cuadrado), chequeo de privacidad.
- **Prueba:** el video de ejemplo sale en los tres formatos con la música empalmada al compás.

### Etapa 4: a demanda
Vista previa interactiva, subtítulos, 3D, Lottie, video embebido.

## Cuestionario de la skill

1. Objetivo del video y a quién va dirigido.
2. Duración y formato.
3. Temas o proyectos que entran y de dónde sale la información de cada uno.
4. Material visual: capturas, código, accesos, design system.
5. Cifras reales o emuladas; qué no puede aparecer.
6. Texto en pantalla: titulares, rótulos, subtítulos o nada.
7. Música y efectos de sonido.
8. Dónde se va a mostrar (define licencias y peso del archivo).

## Reglas aprendidas (base de `docs/reglas.md`)

- Las herramientas se recrean con su estructura y sus rótulos reales; no se usan capturas.
- Si la herramienta real es oscura, se deja oscura para que se reconozca.
- El titular de la escena se aparta solo cuando la cámara se acerca; las vistas generales dejan lugar arriba.
- Acercamiento rápido en cada acción clave; desenfoque de movimiento en los viajes largos.
- Entre un tema y otro se vuelve al listado, se tilda el visto y se entra al siguiente.
- Los subtítulos se probaron y se sacaron: mejor que la imagen se explique sola.
- Los flujos tienen dirección: lo que sale hacia un lado vuelve por el mismo eje.
- Cada escena termina atravesando un elemento hacia la siguiente.
- Antes de mostrar una escena: revisar cuadros clave en una hoja de cuadros.
- La música arranca donde entra la percusión y los empalmes caen en el compás.

## Cómo se desarrolla: orquestador y agentes

El orquestador (la sesión principal) no escribe código: define la tarea, reparte, revisa los resultados y decide. Cada agente recibe un encargo acotado con archivos, criterio de aceptación y prueba a correr, y trabaja en su propia rama o worktree.

| Agente | Encargo |
|---|---|
| Motor | `engine/`: reloj, interpolación, secuencias, espera de recursos |
| Render | Captura con Chromium, ffmpeg, paralelismo, render por partes |
| Kit | Migrar y generalizar cámara, cursor, garabatos, titular; después resortes, transiciones, trazados |
| Temas | Adaptador de tokens y tema neutro |
| Historias | Apertura, vuelta al listado y cierre desde configuración |
| Audio | Tempo, empalme al compás, efectos de sonido |
| Calidad | Control de calidad, privacidad, hoja de cuadros, prueba de equivalencia |
| Skill y docs | Cuestionario, etapas, reglas, guía de escenas |
| Revisor | Lee cada entrega sin el contexto del autor y busca errores antes de integrar |

Orden de la etapa 1: Motor y Temas en paralelo → Render y Kit (dependen del Motor) → Historias y Skill → Calidad cierra con la prueba de equivalencia.

## Decisiones tomadas

- Acá van solo el motor, el kit y ejemplos genéricos; las escenas de proyectos concretos viven en sus propios repos.
- El repo es público: solo se incluyen fuentes, sonidos e imágenes con licencia que permita redistribuirlos. Nada de datos, capturas ni escenas de sistemas internos.
- Licencias de fuentes y música de cada tema.
