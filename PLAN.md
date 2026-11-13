# video-estudio: plan

## Estado

Etapa 1 (lo mínimo para rehacer un video) entregada, salvo lo que figura como pendiente.

- Hecho: motor (`useFrame`, `interpolate` con curvas, `random(seed)`, `Series`/`Sequence`, audio, espera de recursos, `checkDeterminism`); render con Chromium y ffmpeg, en paralelo y por partes con caché; temas (neutro, oscuro, adaptador de tokens con informe y chequeo de contraste); kit base (cámara con cuadros clave, desenfoque e inclinación, cursor, garabatos, viñeta, titular que se aparta, vuelo de tarjetas, velo); historias (apertura, vuelta al listado y cierre desde un `StorySpec`); skill `video-estudio` con el cuestionario y las etapas con aprobación; `docs/reglas.md`, `docs/guia-escenas.md`, plantillas en `templates/` y `CLAUDE.md`.
- Adelantado de la etapa 2: control de calidad (`ve-qa`, siete reglas), hoja de cuadros (`ve-sheet`) y chequeo de privacidad (`ve-privacy`).
- Pendiente de la etapa 1: la prueba de equivalencia cuadro a cuadro contra la misma escena en Remotion (no hay comparador contra Remotion; `render --check` solo compara el render consigo mismo); caché de render por escena (hoy cualquier cambio invalida todas las partes); registro de videos sin tocar `engine/runtime/videos.ts` a mano.
- Pendiente de etapas siguientes: resortes, transiciones entre escenas, trazados, medición de texto; carpeta `audio/` (tempo, empalme al compás, efectos); piezas de interfaz (navegador, teléfono, tabla, gráfico, chat); formatos vertical y cuadrado; subtítulos, vista previa interactiva.
- Sin definir: licencia del código del repo.

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
