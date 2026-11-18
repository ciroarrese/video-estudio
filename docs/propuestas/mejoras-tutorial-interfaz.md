# Mejoras para Video Studio a partir de un tutorial de interfaz

## Estado

Estado de cada punto de este documento al cerrar la etapa 8 (el texto de abajo se conserva tal como se escribió). Dónde está cada cosa: `kit/README.md` ("Tutorial de interfaz"), `qa/README.md`, `render/README.md`, `docs/audio.md`, `docs/guia-escenas.md` (sección 18) y la skill.

| Punto | Estado | Dónde / por qué |
|---|---|---|
| 1.1 Cámara guiada por focos | Hecho | `guidedCameraPlan` y `guidedCameraKeys` (`kit/`); paradas a mano con `stops` y `returnAt`. |
| 1.2 Cámara sin inclinación | Hecho | Perfil `plana` de `cameraAt` y `projectRect` / `projectPoint` (con inclinación proyectan las esquinas y fallan con un mensaje claro si una queda detrás de la cámara). |
| 1.3 Etiqueta con lado fijo | Hecho | `calloutDecision` y `Callout fixed`; `placeBeside` acepta `align`. |
| 1.4 Barra, tarjeta y marco de paso | Hecho | `ProgressBar`, `DataCard` y `StepFrame`. Límite: horizontal-primero, y con la señal `focus` no atenúa lo demás solo. |
| 1.5 Plantilla de paso | Hecho | `npm run nuevo -- paso <slug> <nombre>`; ejemplo `examples/tutorial-demo`. |
| 2.1 `qa` y el zoom | Hecho | `data-qa-world` (lo emite `World` siempre) y objetivo nunca exceptuado (`data-qa-target`). |
| 2.2 Capas fijas | Hecho | `data-qa-overlay`. |
| 2.3 Ruido de `texto-chico` | Hecho distinto | Una línea por elemento con la cuenta de cuadros, y solo en planos sostenidos; con `data-qa-world` juzga el objetivo asentado con su tamaño efectivo (letra por zoom). |
| 2.4 Detector de saltos | Hecho distinto | Regla `salto` (aviso, no error) sobre pares de cuadros consecutivos; `--pares N` suma pares alrededor de cada cambio de foco. Un asentado más corto que el paso de la grilla de sondeo no se ve. |
| 2.5 Foco centrado | Hecho | Regla `foco-centro` (aviso hasta 85 % de desvío, error más allá). |
| 3.1 Caché sin invalidaciones de más | Hecho en parte | Hecho: la clave solo cuenta los estáticos que el render pidió de verdad; `audio/fuentes/` no se sirve ni entra a la caché; `render` dice por qué no reutilizó. **No hecho: el "prop de solo sonido"** (que apagar el sonido de una escena no vuelva a renderizar el video): no hay forma segura de saber qué props afectan solo al audio sin que cada video lo declare, y declararlo es una API nueva que no se diseñó. Cambiar solo la mezcla ya tarda segundos. |
| 3.2 Esperas largas | Hecho | `render` imprime el tiempo restante estimado; la skill avisa la duración y manda un mensaje a mitad de camino si pasa de 5 minutos. |
| 3.3 Copia liviana | Hecho | `--liviano [MB]`. |
| 3.4 Salidas viejas | Hecho | `npm run limpiar -- <slug>`. |
| 4.1 Normalizar vs. música | Hecho | Aviso al combinar `--lufs` y `--musica-gain`, y `--musica-bajo-efectos <dB>`. |
| 4.2 Informe de mezcla | Hecho (con una salvedad) | `npm run audio -- informe`. La detección de voz es una heurística: solo se probó con voz sintética, no con voces reales; un aviso dice "revisá este tramo". |
| 4.3 Cues por escena | Hecho | `cues` relativos a la escena y `mezcla --video <id>`. |
| 4.4 Audio propio de una escena | Hecho | `audioPropio` en la escena; `empalme` y `mezcla` terminan o bajan la música ahí. |
| 4.5 Detalles menores | Hecho | mp3 a wav automático (en `audio/fuentes/`), `--gain nombre=0` nombrado en la skill y en `docs/audio.md`, pausas internas de la pista informadas por `empalme`. |
| 5.1 a 5.5 Skill | Hecho | Cuestionario ampliado, modo corrido, `referencias/`, respaldo con `git init` local y `.video-studio.local.json` (ver `.claude/skills/video-estudio/SKILL.md`). |
| 6 Privacidad | Hecho | La ficha `datos-emulados.txt` es lista de permitidos (valores o `/regex/`), el formato de comprobante se reconoce antes de clasificar un teléfono. |
| 7 Criterios de tutoriales | Hecho | `docs/guia-escenas.md`, sección 18. |

Documento de trabajo, escrito el 18/11/2026. Reúne lo que costó, lo que hubo que construir a mano y lo que la persona corrigió durante la producción de un video real, para llevarlo al proyecto original (motor, kit, QA, audio, skill y documentación).

## Alcance

- **El video:** tutorial horizontal de 2:41 (4820 cuadros, 1920x1080, 30 fps) que recrea una aplicación de gestión de escritorio: intro, 11 pasos y cierre, con efectos de sonido y música de fondo.
- **Qué queda afuera:** todo lo propio del design system (colores, tipografías, logo, plantillas de intro y cierre, cortina de marca).
- **Sin nombres reales:** el texto no menciona marcas ni clientes, así se puede copiar al repo público tal cual.
- **Límite de este registro:** tengo el detalle de la segunda mitad de la producción (del paso 8 en adelante, el rediseño, el armado y el sonido). De las primeras etapas solo conservo un resumen, así que puede faltar algún problema de esa parte.
- **Sobre lo que ya existe:** revisé el índice del kit, `render/README.md` y partes de `docs/`, no todo el código. Donde propongo algo que quizás ya esté cubierto, lo marco como "verificar".

## Resumen por prioridad

| # | Mejora | Área | Por qué primero |
|---|---|---|---|
| 1 | Cámara guiada por focos, sin inclinación | Kit | La pidió la persona y hubo que reescribir la cámara de las 11 escenas. |
| 2 | QA que entienda el zoom y las capas fijas | QA | Hubo que callar cuatro reglas en toda la interfaz durante el zoom. |
| 3 | Detector de saltos entre cuadros vecinos | QA | El defecto de las etiquetas que saltaban lo encontró la persona, no el control. |
| 4 | Clave de caché que no se invalide por archivos que no se usan | Render | Dos renders completos de 12 minutos que no hacían falta. |
| 5 | Cues de sonido por escena, en cuadros relativos | Audio | Los cuadros absolutos se calcularon a mano y cambian con cada duración. |
| 6 | Informe de mezcla para verificar sin escuchar | Audio | El agente no oye: los tres ajustes de sonido los detectó la persona. |
| 7 | Cuestionario con sonido, música y canal de revisión | Skill | Esas decisiones aparecieron al final y costaron tres rondas. |
| 8 | Criterios para tutoriales de interfaz | Docs | Las correcciones de diseño de la persona son reglas generales. |

## 1. Cámara y señalamiento

### 1.1 Cámara guiada por focos

**Qué pasó.** Cada escena tenía sus claves de cámara escritas a mano. La persona pidió que todo lo señalado quedara centrado en pantalla y que la cámara se moviera más. Hubo que escribir un ayudante propio (`clavesFoco`) y cambiar las 11 escenas con un script.

**Propuesta.** Llevar ese ayudante al kit. Recibe la vista general, el rango de acercamiento y de alejamiento y la lista de señales, y devuelve las claves:

- vista general, acercamiento y después cada objetivo señalado centrado;
- la cámara llega unos cuadros después de que empieza la señal (14) y viaja en un tiempo fijo (22);
- el zoom se limita solo si el objetivo es más ancho que el área útil;
- acepta paradas a mano para encuadres que no son una señal.

### 1.2 Cámara sin inclinación para interfaces

**Qué pasó.** `cameraAt` inclina la imagen según la velocidad. Las etiquetas vivían en coordenadas de pantalla, fuera de `World`, y se calculaban con una proyección plana. Durante los viajes quedaban desfasadas un cuadro y se acomodaban al siguiente.

**Propuesta.**

- Un perfil con nombre (por ejemplo `plana`) que apague inclinación y desenfoque, recomendado en la guía para recorridos de interfaz.
- Una función del kit que proyecte un rectángulo del mundo a la pantalla. Tiene que contemplar la inclinación o fallar con un mensaje claro si la cámara la usa. Verificar si `cameraView` ya sirve de base.

### 1.3 Etiqueta pegada al foco, con lado fijo

**Qué pasó.** La persona pidió las etiquetas explicativas al lado del foco, para no desviar la mirada. La primera versión elegía el lado en cada cuadro según el espacio libre, y con la cámara en movimiento la etiqueta cambiaba de lado.

**Propuesta.** Que la pieza de señalamiento decida lado y alineación una sola vez, con la cámara ya asentada, y que después solo siga al rectángulo. Verificar si `Callout` y `placeBeside` ya lo permiten; si no, agregar una opción para fijar la decisión.

### 1.4 Piezas que faltaron

- **Barra de progreso única:** una sola barra fina arriba, sin fondo ni rótulo, que avanza con el paso y el avance dentro del paso. La versión por etapas se descartó porque se veía larga.
- **Tarjeta de dato ampliado:** rótulo y valor grande junto al foco, del lado indicado, para importes o números que a tamaño de interfaz no se leen.
- **Marco de paso:** un envoltorio que recibe la cámara y la lista de señales y dibuja foco, etiqueta, tarjeta y progreso. Con eso la escena declara tiempos y señales y nada más.

### 1.5 Plantilla de paso

**Qué pasó.** Un cambio de diseño transversal obligó a tocar 11 archivos casi iguales con scripts de reemplazo. Uno falló a mitad de camino por una diferencia mínima de escritura entre escenas.

**Propuesta.** `npm run nuevo -- paso <slug> <nombre>`: una escena de tutorial que ya usa el marco, la cámara guiada y la tabla de tiempos. Lo repetido queda en un solo lugar.

## 2. Control de calidad (QA)

### 2.1 Zoom sobre una interfaz recreada

**Qué pasó.** Con la cámara acercada y el foco centrado, parte de la interfaz queda cortada por el borde a propósito. `qa` lo marcó como error (`offscreen`, `covered`, `overlap`, `contrast`). Primero se ajustó la cámara a mano para esquivarlo; al final hubo que poner `data-qa-ignore` con las cuatro reglas en toda la interfaz mientras el zoom pasa de 1,02. El control quedó debilitado justo en los planos que más se miran, y se compensó revisando hojas de cuadros.

**Propuesta.**

- Una marca para el contenedor del mundo (por ejemplo `data-qa-world`). Con ella, `qa` juzga solo lo que queda entero dentro del encuadre y baja a `info` lo que el borde corta.
- Que el objetivo de la señal activa nunca se exceptúe: si está cortado o tapado, es error.

### 2.2 Capas fijas sobre el mundo

**Qué pasó.** La barra de progreso y las etiquetas son capas en espacio de pantalla. Al pasar por encima de texto de la interfaz generaron errores de `covered` y `contrast` sobre ese texto.

**Propuesta.** Una marca `data-qa-overlay` para anotaciones del video. Lo que tapan no cuenta como defecto, salvo que sea el objetivo de la señal activa.

### 2.3 Ruido de `texto-chico`

**Qué pasó.** Cada escena dio entre 156 y 543 avisos de `texto-chico` en 40 cuadros. Una interfaz recreada a escala real tiene letra chica por naturaleza, y los avisos útiles se perdían entre cientos.

**Propuesta.**

- Agrupar por elemento y mostrar una línea por grupo con la cuenta.
- Juzgar el tamaño efectivo (letra por zoom de cámara) y solo dentro del objetivo señalado en planos sostenidos. Eso sí dice algo: si lo que se señala no se lee, falta zoom o falta una tarjeta de dato.

### 2.4 Detector de saltos

**Qué pasó.** Las etiquetas desfasadas un cuadro pasaron `qa` y `--check`. Las vio la persona en el video final.

**Propuesta.** Una regla nueva que compare cuadros vecinos y avise cuando un elemento se mueve mucho más que la cámara, o cambia de lado respecto de su ancla, en un solo cuadro. Conviene muestrear pares de cuadros consecutivos alrededor de cada clave de cámara y de cada inicio de señal.

### 2.5 Foco centrado

**Propuesta.** Con la cámara guiada, `qa` puede comprobar que el objetivo de la señal activa queda dentro de la zona central una vez asentada la cámara. Es la regla que pidió la persona, convertida en control.

## 3. Render y caché

### 3.1 Caché que se pierde sin cambios de imagen

**Qué pasó.** Medido sobre el video completo (33 partes):

| Cambio antes del render | Resultado |
|---|---|
| Se agregaron archivos a `audio/` (la pista original, su wav y el empalme) | 0 en caché, 767 s |
| Solo cambiaron la mezcla y `cues.json` | 33 en caché, 13 s |
| Cambió una prop de sonido en la historia y el empalme | 0 en caché, 741 s |

La documentación dice que la clave de partes incluye ruta, tamaño y fecha de todas las carpetas de estáticos servidas. Eso explicaría el primer caso; no lo verifiqué en el código. En el tercero cambió código, y la clave es por video entero.

**Propuesta.**

- Que la clave incluya solo los estáticos que el render pidió de verdad (el servidor sabe qué URLs sirvió), no todo lo que hay en la carpeta.
- Mientras tanto, documentar una subcarpeta que no se sirve (por ejemplo `audio/fuentes/`) para pistas originales y archivos intermedios.
- Que una prop que solo afecta al audio no cambie la clave de las partes de video. Hoy apagar el sonido de una escena vuelve a renderizar todo.
- Que `render` diga por qué no usó la caché ("cambió el bundle", "cambió la carpeta de estáticos X").

### 3.2 Esperas largas

**Qué pasó.** El render completo tardó unos 12,5 minutos (6,5 cuadros por segundo). La persona preguntó varias veces si ya había terminado. El tiempo se va en la captura de pantalla (3386 s sumados entre las 6 páginas, contra 673 s de dibujar el cuadro), un costo que la documentación ya da por conocido.

**Propuesta.**

- Imprimir el tiempo estimado restante junto al porcentaje.
- En la skill: avisar la duración estimada antes de lanzar y mandar un mensaje corto a mitad de camino en renders de más de 5 minutos.

### 3.3 Copia liviana

**Qué pasó.** El mp4 final pesa 53 MB y el canal remoto por el que revisaba la persona admite 30 MiB. Cada entrega necesitó una segunda pasada de ffmpeg a mano (crf 27, audio copiado, 24 MB).

**Propuesta.** Una opción `--liviano [MB]` en `render` que deje al lado `<id>-liviano.mp4` apuntando a un tamaño máximo.

### 3.4 Salidas viejas

**Qué pasó.** En `out/` se juntaron mp4 por escena de diseños anteriores, hojas de prueba y carpetas de cuadros. Hubo que borrarlos a mano, pidiendo confirmación.

**Propuesta.** `npm run limpiar -- <slug>`: lista las salidas del video que son más viejas que su código y las borra con confirmación.

## 4. Audio

### 4.1 Normalizar vuelve a subir la música

**Qué pasó.** La persona pidió bajar la música. Con `--lufs`, bajar `--musica-gain` casi no cambia nada: la música domina la sonoridad integrada y la normalización la devuelve al mismo nivel, subiendo de paso los efectos (el limitador llegó a recortar 4 dB). Hubo que quitar `--lufs`.

**Propuesta.**

- Avisar cuando se combinan `--lufs` y `--musica-gain`: el nivel de la música lo fija el objetivo.
- Una opción para expresar la relación directamente, por ejemplo `--musica-bajo-efectos 12` (dB), con el nivel general aparte.

### 4.2 Informe de mezcla

**Qué pasó.** El agente no puede escuchar. Verificó con medidas sueltas (sonoridad, pico, detección de silencios) que los sonidos caían donde debían. Los tres problemas reales los encontró la persona: música alta, un sonido que no quería y una voz en el cierre.

**Propuesta.** `npm run audio -- informe`, que entregue:

- línea de tiempo con cada pista y cada cue;
- margen de cada efecto sobre la música en ese instante, para ver qué queda tapado y qué sobresale;
- silencios y solapamientos entre pistas (por ejemplo, la música de la historia contra el audio propio de una escena);
- detección de voz en cualquier pista, reutilizando el detector de locución, para avisar que hay una voz donde no se pidió.

### 4.3 Cues por escena

**Qué pasó.** Los 70 cues se escribieron en cuadros absolutos del video, sumando a mano el inicio de cada escena a sus tiempos internos. Dos escenas cambiaron de duración durante la producción, y eso corre todos los cues siguientes.

**Propuesta.** Que cada escena exporte sus cues en cuadros relativos, derivados de su propia tabla de tiempos, y que la historia los junte con el desplazamiento correcto. `mezcla` aceptaría `--video <id>` en lugar de `--cues`.

### 4.4 Música de la historia y audio de una escena

**Qué pasó.** El cierre traía su propio sonido. Hubo que calcular a mano dónde terminar la música para no pisarlo y, cuando se lo quitó, rehacer el empalme con otra duración.

**Propuesta.** Que la historia declare qué escenas llevan audio propio. `empalme` y `mezcla` usarían eso para terminar o bajar la música antes de esas escenas.

### 4.5 Detalles menores

- **Fuente en mp3:** convertirla a wav automáticamente al entrar, en lugar de solo avisar.
- **Quitar una clase de efectos:** `--gain nombre=0` ya existe. Conviene nombrarlo en la skill como la manera rápida de probar "sin ese sonido" antes de tocar la lista de cues.
- **Pausas propias de la pista:** que `empalme` informe los silencios internos de la pista, para no confundirlos con un corte de la mezcla.

## 5. Skill y flujo de trabajo

### 5.1 Cuestionario

Preguntas que faltaron al principio y aparecieron al final:

- **Música de fondo:** si lleva, si la trae la persona y con qué licencia. Ofrecer fuentes con uso comercial y sin atribución.
- **Sonidos, clase por clase:** clics, tecleo, tildes y apariciones. En este video las apariciones de ventanas, filas y tarjetas se quitaron enteras: para tutoriales conviene que estén apagadas por defecto.
- **Sonido de las plantillas:** si la intro o el cierre traen audio propio (y si tiene voz), confirmarlo antes de usarlo.
- **Canal de revisión:** si la persona revisa en remoto, hay límite de tamaño. Generar la copia liviana desde la primera entrega.

### 5.2 Modo corrido

**Qué pasó.** Después de aprobar diez escenas una por una, la persona pidió terminar el resto y armar el video, para corregir sobre el final.

**Propuesta.** Cuando el diseño ya quedó estable (por ejemplo, tres escenas seguidas aprobadas sin cambios), ofrecer seguir de corrido hasta el video mudo.

### 5.3 Material de referencia

**Qué pasó.** Las capturas de la aplicación real solo estaban en la conversación. Tras una compactación de contexto hubo que recuperarlas del registro de la sesión para rehacer una ventana que no coincidía con la original.

**Propuesta.** Guardar todo lo que manda la persona en `<slug>/referencias/` en cuanto llega. Esa carpeta no se sirve, no se versiona y queda fuera del control de privacidad de cuadros. Anotar en la ficha qué captura corresponde a cada pantalla.

### 5.4 Respaldo antes de un cambio grande

**Qué pasó.** La carpeta externa de videos no tiene control de versiones. Antes del cambio transversal de cámara se copió el proyecto entero a una carpeta temporal.

**Propuesta.** Que la skill ofrezca `git init` local en la carpeta de videos al crear el primero, sin remoto, y que haga un commit al aprobar cada etapa.

### 5.5 Carpeta externa y terminal

**Qué pasó.** Cada comando necesitó `cd` al clon y la variable `VE_VIDEOS_DIR`, con una ruta que tiene espacios y corchetes. La terminal vuelve a su carpeta en cada llamada.

**Propuesta.** Un archivo de configuración local en el clon, ignorado por git, con la carpeta de videos. Los comandos lo leerían cuando la variable no está definida.

## 6. Privacidad

**Qué pasó.** El control marcó como teléfono un número de comprobante emulado, y hubo que agregar a mano a la lista de permitidos cada número inventado (comprobantes y cuentas).

**Propuesta.**

- Que la ficha de datos emulados sea la fuente de la lista de permitidos: lo que figura ahí se permite solo.
- Reconocer el formato de comprobante (cuatro dígitos, guion, ocho dígitos) antes de clasificarlo como teléfono.
- Verificar si la lista de permitidos acepta patrones; si no, agregarlos.

## 7. Criterios para tutoriales de interfaz

Son las correcciones de la persona, que valen como reglas generales para una sección nueva de `docs/guia-escenas.md`.

- **Foco al centro:** lo que se señala va al centro de la pantalla. La cámara se mueve de un foco al siguiente en lugar de quedarse en un encuadre fijo.
- **Etiqueta junto al foco:** el texto explicativo va pegado a lo señalado, no en una franja lejana.
- **Progreso discreto:** una sola barra fina arriba, sin fondo. No hace falta una por etapa ni un rótulo "Paso N de M".
- **Fidelidad a la captura:** botones, solapas y orden de los campos como en la aplicación real. Una pantalla "parecida" se nota y hay que rehacerla.
- **Datos inventados con lógica:** el valor emulado respeta el tipo del campo. Un campo "Nº de cuenta" lleva un número de cuenta, no un correo.
- **Nada de datos reales:** todo dato de las capturas se reemplaza y se controla con la lista de prohibidos.
- **Sonido sobrio:** clics, tecleo y tildes. Sin sonido para ventanas que se abren o focos sobre importes.
- **Estabilidad cuadro a cuadro:** revisar los viajes de cámara mirando cuadros consecutivos, no solo una hoja con cuadros espaciados.
